import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const pnpmCli = process.env.npm_execpath;

function fail(message) {
	console.error(`\nSetup stopped: ${message}`);
	process.exit(1);
}

function run(command, args, { capture = false } = {}) {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: "utf8",
		stdio: capture ? "pipe" : "inherit",
		env: process.env,
	});

	if (result.error) {
		fail(`${command} could not run: ${result.error.message}`);
	}

	if (result.status !== 0) {
		if (capture) {
			if (result.stdout) process.stdout.write(result.stdout);
			if (result.stderr) process.stderr.write(result.stderr);
		}
		return null;
	}

	return capture ? result.stdout : "";
}

function runPnpm(args, options) {
	if (pnpmCli) return run(process.execPath, [pnpmCli, ...args], options);
	return run(pnpm, args, options);
}

function parseSupabaseEnv(raw) {
	const values = new Map();
	for (const line of raw.split("\n")) {
		const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		values.set(match[1], value);
	}
	return values;
}

function upsertEnv(contents, key, value) {
	const line = `${key}=${value}`;
	const pattern = new RegExp(`^${key}=.*$`, "m");
	if (pattern.test(contents)) return contents.replace(pattern, () => line);
	return `${contents.trimEnd()}\n${line}\n`;
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
if (nodeMajor !== 24) {
	fail(
		`Kwartrack supports Node 24.x. You are running ${process.version}. ` +
			"Use `nvm use`, Volta, mise, or another version manager, then retry.",
	);
}

console.log("Checking Docker…");
if (run("docker", ["info"], { capture: true }) === null) {
	fail("Docker is not available. Start Docker Desktop (or the Docker daemon), then retry.");
}

console.log("Installing dependencies from the lockfile…");
if (runPnpm(["install", "--frozen-lockfile"]) === null) {
	fail("dependency installation failed.");
}

console.log("Starting the local Supabase stack…");
if (runPnpm(["exec", "supabase", "start"]) === null) {
	fail(
		"Supabase did not start. If an old Kwartrack stack is blocking Docker, run " +
			"`pnpm supabase:stop --no-backup` only after confirming you do not need its local data, then retry.",
	);
}

const status = runPnpm(["exec", "supabase", "status", "-o", "env"], {
	capture: true,
});
if (status === null) fail("Supabase started, but its local credentials could not be read.");

const supabase = parseSupabaseEnv(status);
const apiUrl = supabase.get("API_URL");
const publishableKey = supabase.get("PUBLISHABLE_KEY") ?? supabase.get("ANON_KEY");
const secretKey = supabase.get("SECRET_KEY") ?? supabase.get("SERVICE_ROLE_KEY");
if (!apiUrl || !publishableKey || !secretKey) {
	fail("Supabase status did not return the expected API, publishable, and secret values.");
}

const envPath = new URL("../.env.local", import.meta.url);
let envContents = existsSync(envPath)
	? readFileSync(envPath, "utf8")
	: readFileSync(new URL("../.env.example", import.meta.url), "utf8");
envContents = upsertEnv(envContents, "VITE_SUPABASE_URL", apiUrl);
envContents = upsertEnv(envContents, "VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
envContents = upsertEnv(envContents, "SUPABASE_SECRET_KEY", secretKey);
writeFileSync(envPath, envContents, { mode: 0o600 });
chmodSync(envPath, 0o600);

let demoReady = false;
try {
	const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
		method: "POST",
		headers: {
			apikey: publishableKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: "demo@kwartrack.local",
			password: "demo-password",
		}),
	});
	demoReady = response.ok;
} catch {
	// Supabase is already healthy; a missing demo account is non-fatal for an
	// existing local database that predates the synthetic fixture.
}

console.log("\nKwartrack is ready for local development.");
console.log("  App:     pnpm dev");
console.log("  Studio:  http://127.0.0.1:54323");
console.log(
	demoReady
		? "  Demo:    demo@kwartrack.local / demo-password"
		: "  Demo:    run `pnpm supabase:reset` to load the synthetic demo account",
);
console.log("  Verify:  pnpm test && pnpm build");
