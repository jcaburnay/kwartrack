import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { parseEnv } from "node:util";
import { fail, localEnvironment, readBackendEnvironment, root, run } from "./infra/common.mjs";

async function configureApi() {
	const backend = readBackendEnvironment();
	const target = `${root}apps/api/.env.local`;
	let content = existsSync(target)
		? readFileSync(target, "utf8")
		: readFileSync(`${root}apps/api/.env.example`, "utf8");
	const existing = parseEnv(content);
	if (existing.DATABASE_URL && existing.DATABASE_URL !== backend.API_HOST_DATABASE_URL) {
		throw new Error(
			"API .env.local uses another database; review it before rerunning local setup.",
		);
	}
	if (!existing.DATABASE_URL) content += `\nDATABASE_URL=${backend.API_HOST_DATABASE_URL}\n`;
	const { readLocalConfig } = await import("../../apps/api/dist/config/local-config.js");
	readLocalConfig({ ...localEnvironment(), ...parseEnv(content) });
	writeFileSync(target, content, { mode: 0o600 });
	chmodSync(target, 0o600);
	return backend;
}

async function waitForApi() {
	for (let attempt = 0; attempt < 30; attempt++) {
		try {
			const response = await fetch("http://127.0.0.1:3000/health/ready", {
				signal: AbortSignal.timeout(2000),
			});
			if (response.status === 200) return;
		} catch {
			// The API can still be starting; retry within the bounded setup window.
		}
		await setTimeout(1000);
	}
	throw new Error("API readiness failed; inspect this project's API and Floci logs.");
}

try {
	localEnvironment();
	run("pnpm", ["api:build"]);
	run(process.execPath, ["scripts/local/infra/setup.mjs"]);
	const env = await configureApi();
	const databaseEnv = { DATABASE_URL: env.API_HOST_DATABASE_URL };
	run("pnpm", ["api:db:migrate"], { env: databaseEnv });
	run("pnpm", ["api:db:seed"], { env: databaseEnv });
	run(process.execPath, ["scripts/local/infra/api.mjs", "up"]);
	await waitForApi();
	run(process.execPath, ["scripts/local/infra/smoke.mjs"]);
	console.log("Local backend setup verified. API docs: http://127.0.0.1:3000/docs");
} catch (error) {
	fail(error);
}
