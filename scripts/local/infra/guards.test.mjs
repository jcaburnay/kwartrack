import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";
import { localEnvironment, root, validateTerraformEndpoints } from "./common.mjs";

const originalEnvironment = { ...process.env };
afterEach(() => {
	for (const key of Object.keys(process.env))
		if (!(key in originalEnvironment)) delete process.env[key];
	Object.assign(process.env, originalEnvironment);
});

test("infrastructure commands require an explicit local mode", () => {
	delete process.env.APP_ENV;
	assert.throws(() => localEnvironment(), /APP_ENV=local/);
	process.env.APP_ENV = "production";
	assert.throws(() => localEnvironment(), /APP_ENV=local/);
});

test("a supplied hosted or different local AWS endpoint is rejected", () => {
	process.env.APP_ENV = "local";
	for (const endpoint of [
		"https://rds.us-east-1.amazonaws.com",
		"http://127.0.0.1:9999",
		"http://127.0.0.1:4566.attacker.test",
	]) {
		process.env.AWS_ENDPOINT_URL = endpoint;
		assert.throws(() => localEnvironment(), /AWS_ENDPOINT_URL/);
	}
});

test("child commands receive only dummy credentials and no inherited AWS routing or profile", () => {
	process.env.APP_ENV = "local";
	delete process.env.AWS_ENDPOINT_URL;
	Object.assign(process.env, {
		AWS_PROFILE: "personal",
		AWS_SESSION_TOKEN: "fixture-session",
		AWS_ACCESS_KEY_ID: "fixture-inherited-key",
		AWS_ENDPOINT_URL_RDS: "https://rds.us-east-1.amazonaws.com",
		AWS_WEB_IDENTITY_TOKEN_FILE: "/tmp/fixture-token",
	});
	const env = localEnvironment();
	assert.equal(env.AWS_ACCESS_KEY_ID, "test");
	assert.equal(env.AWS_SECRET_ACCESS_KEY, "test");
	assert.equal(env.AWS_EC2_METADATA_DISABLED, "true");
	assert.equal(env.AWS_CONFIG_FILE, "/dev/null");
	assert.equal(env.AWS_SHARED_CREDENTIALS_FILE, "/dev/null");
	for (const key of [
		"AWS_PROFILE",
		"AWS_SESSION_TOKEN",
		"AWS_ENDPOINT_URL_RDS",
		"AWS_WEB_IDENTITY_TOKEN_FILE",
	])
		assert.equal(env[key], undefined);
});

function providerConfiguration(services) {
	return `provider "aws" {\nendpoints {\n${services.map(([service, endpoint]) => `${service} = "${endpoint}"`).join("\n")}\n}\n}`;
}

const services = ["apigateway", "apigatewayv2", "ec2", "elbv2", "rds", "sts"].map((service) => [
	service,
	"http://127.0.0.1:4566",
]);

test("all used AWS services must have explicit local provider endpoints", () => {
	assert.doesNotThrow(() => validateTerraformEndpoints(providerConfiguration(services)));
	for (const missing of services) {
		assert.throws(
			() =>
				validateTerraformEndpoints(
					providerConfiguration(services.filter(([name]) => name !== missing[0])),
				),
			/endpoints/,
		);
	}
});

test("a hosted provider endpoint or additional AWS provider fails closed", () => {
	const hosted = services.map(([name, endpoint]) => [
		name,
		name === "apigatewayv2" ? "https://apigateway.us-east-1.amazonaws.com" : endpoint,
	]);
	assert.throws(() => validateTerraformEndpoints(providerConfiguration(hosted)), /endpoints/);
	assert.throws(
		() =>
			validateTerraformEndpoints(
				`${providerConfiguration(services)}\nprovider "aws" { alias = "other" }`,
			),
		/Only the reviewed/,
	);
});

test("reset without the explicit data-loss flag stops before Docker is invoked", () => {
	const result = spawnSync(
		process.execPath,
		[`${root}scripts/local/infra/lifecycle.mjs`, "reset"],
		{
			env: { APP_ENV: "local", PATH: "/not-a-tool-directory" },
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /confirm-local-data-loss/);
	assert.doesNotMatch(result.stderr, /docker failed/);
});
