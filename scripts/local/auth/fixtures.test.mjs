import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { root } from "../infra/common.mjs";
import { validateOwnedPool } from "./fixtures.mjs";

const settings = { poolId: "us-east-1_fixture", clientId: "fixtureclient" };
const pool = {
	Id: settings.poolId,
	Name: "kwartrack-api-local",
	UserPoolTags: { project: "kwartrack-backend-local" },
};
const client = {
	UserPoolId: settings.poolId,
	ClientId: settings.clientId,
	ClientName: "kwartrack-api-local-public",
	ExplicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
};

test("fixture administration permits only the expected project pool and public client", () => {
	assert.doesNotThrow(() => validateOwnedPool(settings, pool, client));
	for (const wrong of [
		{ ...pool, Id: "anotherpool" },
		{ ...pool, Name: "another-project" },
		{ ...pool, UserPoolTags: {} },
	]) {
		assert.throws(() => validateOwnedPool(settings, wrong, client), /owned pool/);
	}
	for (const wrong of [
		{ ...client, ClientId: "anotherclient" },
		{ ...client, UserPoolId: "anotherpool" },
		{ ...client, ClientSecret: "fixture-secret" },
		{
			...client,
			ExplicitAuthFlows: [...client.ExplicitAuthFlows, "ALLOW_ADMIN_USER_PASSWORD_AUTH"],
		},
	])
		assert.throws(() => validateOwnedPool(settings, pool, wrong), /public client/);
});

test("auth reset without confirmation cannot reach infrastructure tools", () => {
	const response = spawnSync(process.execPath, [`${root}scripts/local/auth/reset.mjs`], {
		env: { APP_ENV: "local", PATH: "/not-a-tool-directory" },
		encoding: "utf8",
	});
	assert.equal(response.status, 1);
	assert.match(response.stderr, /confirm-local-auth-data-loss/);
	assert.doesNotMatch(response.stderr, /terraform|aws failed|ENOENT/);
});
