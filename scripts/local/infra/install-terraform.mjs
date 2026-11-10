import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { fail, localEnvironment, root, run } from "./common.mjs";

const version = "1.13.4";
let temporary;

try {
	localEnvironment();
	const os = platform();
	const cpu = { arm64: "arm64", x64: "amd64" }[arch()];
	if (!["darwin", "linux"].includes(os) || !cpu)
		throw new Error("Supported Terraform hosts are macOS/Linux on arm64/amd64.");
	const tools = `${root}infra/local/.tools`;
	mkdirSync(tools, { recursive: true });
	temporary = mkdtempSync(`${tools}/download-`);
	const filename = `terraform_${version}_${os}_${cpu}.zip`;
	const base = `https://releases.hashicorp.com/terraform/${version}`;
	const checksums = await fetch(`${base}/terraform_${version}_SHA256SUMS`, {
		signal: AbortSignal.timeout(30_000),
	});
	if (!checksums.ok) throw new Error("Could not download Terraform checksums.");
	const expected = (await checksums.text())
		.split("\n")
		.find((line) => line.endsWith(`  ${filename}`))
		?.split(/\s+/)[0];
	if (!expected || !/^[a-f0-9]{64}$/.test(expected))
		throw new Error("Pinned Terraform checksum is missing.");
	const response = await fetch(`${base}/${filename}`, { signal: AbortSignal.timeout(60_000) });
	if (!response.ok) throw new Error("Could not download Terraform archive.");
	const archive = Buffer.from(await response.arrayBuffer());
	if (createHash("sha256").update(archive).digest("hex") !== expected)
		throw new Error("Terraform checksum mismatch; refusing to install.");
	writeFileSync(`${temporary}/${filename}`, archive);
	run("unzip", ["-q", `${temporary}/${filename}`, "-d", temporary], { capture: true });
	chmodSync(`${temporary}/terraform`, 0o755);
	renameSync(`${temporary}/terraform`, `${tools}/terraform`);
	console.log(`Installed checksum-verified Terraform ${version} in ignored infra/local/.tools.`);
} catch (error) {
	fail(error);
} finally {
	if (temporary) rmSync(temporary, { recursive: true, force: true });
}
