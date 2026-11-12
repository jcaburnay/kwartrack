import assert from "node:assert/strict";
import { ConfigService } from "../../../apps/api/dist/config/config.module.js";
import { readLocalConfig } from "../../../apps/api/dist/config/local-config.js";
import { DatabaseService } from "../../../apps/api/dist/database/database.service.js";
import { fail, readBackendEnvironment, run } from "../infra/common.mjs";
import { authSettings } from "./cognito.mjs";
import { checkOwnership, fixtureSubjects } from "./fixtures.mjs";

async function databaseSnapshot() {
	const config = readLocalConfig({
		APP_ENV: "local",
		DATABASE_URL: readBackendEnvironment().API_HOST_DATABASE_URL,
	});
	const database = new DatabaseService(new ConfigService(config));
	try {
		return (
			await database.pool.query(
				"SELECT id, name, created_at FROM development.dev_fixture ORDER BY id",
			)
		).rows;
	} finally {
		await database.onApplicationShutdown();
	}
}

try {
	const before = authSettings();
	checkOwnership(before);
	const subjects = fixtureSubjects(before);
	const database = await databaseSnapshot();
	run("pnpm", ["local:stop"]);
	run("pnpm", ["local:setup"]);
	const after = authSettings();
	assert.deepEqual(after, before);
	assert.deepEqual(fixtureSubjects(after), subjects);
	assert.deepEqual(await databaseSnapshot(), database);
	run("pnpm", ["local:auth:smoke"]);
	console.log(
		"PASS stop/start preserves pool/client, fixture subjects, and existing database fixtures.",
	);
} catch (error) {
	fail(error);
}
