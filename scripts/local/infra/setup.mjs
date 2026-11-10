import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { compose, endpoint, fail, localEnvironment, root, run, terraform } from "./common.mjs";
import { generateEnvironment } from "./environment.mjs";

try {
	localEnvironment();
	run("docker", ["info", "--format", "{{.ServerVersion}}"], { capture: true, timeout: 10_000 });
	run("aws", ["--version"], { capture: true, timeout: 10_000 });
	terraform(["version"], { capture: true });
	const credentialFile = `${root}infra/terraform/local/local.auto.tfvars.json`;
	if (!existsSync(credentialFile)) {
		writeFileSync(
			credentialFile,
			`${JSON.stringify({ database_password: randomBytes(24).toString("hex") })}\n`,
			{ mode: 0o600, flag: "wx" },
		);
	}
	compose(["up", "-d", "floci"]);
	let ready = false;
	for (let attempt = 0; attempt < 30; attempt++) {
		try {
			run(
				"aws",
				[
					"--endpoint-url",
					endpoint,
					"--cli-connect-timeout",
					"2",
					"--cli-read-timeout",
					"2",
					"sts",
					"get-caller-identity",
				],
				{ capture: true, timeout: 5_000 },
			);
			ready = true;
			break;
		} catch {
			await setTimeout(1_000);
		}
	}
	if (!ready) throw new Error("Floci did not become ready; inspect this project's Compose logs.");
	terraform(["init", "-input=false"]);
	terraform(["apply", "-input=false", "-auto-approve"]);
	generateEnvironment();
	console.log(
		"Local RDS and routing resources are ready. Connection settings are in infra/local/backend.env.local.",
	);
} catch (error) {
	fail(error);
}
