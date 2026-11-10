import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const composeFile = `${root}infra/local/compose.yaml`;
export const terraformRoot = `${root}infra/terraform/local`;
export const endpoint = "http://127.0.0.1:4566";

export function localEnvironment() {
	if (process.env.APP_ENV !== "local") throw new Error("APP_ENV=local is required.");
	if (process.env.AWS_ENDPOINT_URL && process.env.AWS_ENDPOINT_URL !== endpoint) {
		throw new Error("Infrastructure commands require AWS_ENDPOINT_URL=http://127.0.0.1:4566.");
	}
	const env = { ...process.env };
	for (const key of Object.keys(env)) if (key.startsWith("AWS_")) delete env[key];
	return {
		...env,
		APP_ENV: "local",
		AWS_ACCESS_KEY_ID: "test",
		AWS_SECRET_ACCESS_KEY: "test",
		AWS_REGION: "us-east-1",
		AWS_DEFAULT_REGION: "us-east-1",
		AWS_EC2_METADATA_DISABLED: "true",
		AWS_CONFIG_FILE: "/dev/null",
		AWS_SHARED_CREDENTIALS_FILE: "/dev/null",
		AWS_PAGER: "",
		TF_IN_AUTOMATION: "true",
	};
}

export function run(command, args, { capture = false, timeout = 180_000, env = {} } = {}) {
	const result = spawnSync(command, args, {
		cwd: root,
		env: { ...localEnvironment(), ...env },
		encoding: "utf8",
		stdio: capture ? "pipe" : "inherit",
		timeout,
	});
	if (result.error || result.status !== 0) {
		throw new Error(
			`${command} failed (${result.error?.code ?? result.status}); check the local service and tool installation.`,
		);
	}
	return result.stdout?.trim() ?? "";
}

export function aws(args) {
	return JSON.parse(
		run(
			"aws",
			[
				"--endpoint-url",
				endpoint,
				"--cli-connect-timeout",
				"5",
				"--cli-read-timeout",
				"120",
				...args,
				"--output",
				"json",
			],
			{ capture: true },
		),
	);
}

export function terraform(args, options) {
	const source = readFileSync(`${terraformRoot}/main.tf`, "utf8");
	validateTerraformEndpoints(source);
	const binary =
		process.env.TERRAFORM_BIN ??
		(existsSync(`${root}infra/local/.tools/terraform`)
			? `${root}infra/local/.tools/terraform`
			: "terraform");
	return run(binary, [`-chdir=${terraformRoot}`, ...args], options);
}

export function validateTerraformEndpoints(source) {
	const block = source.match(/endpoints\s*\{([^}]+)\}/)?.[1] ?? "";
	const endpoints = new Map(
		[...block.matchAll(/^\s*(\w+)\s*=\s*"([^"]+)"\s*$/gm)].map((entry) => [entry[1], entry[2]]),
	);
	const required = ["apigateway", "apigatewayv2", "ec2", "elbv2", "rds", "sts"];
	if (
		endpoints.size !== required.length ||
		required.some((service) => endpoints.get(service) !== endpoint)
	) {
		throw new Error(
			"Terraform service endpoints are incomplete or nonlocal; refusing to invoke Terraform.",
		);
	}
	if ([...source.matchAll(/provider\s+"aws"\s*\{/g)].length !== 1) {
		throw new Error("Only the reviewed local AWS provider is permitted.");
	}
}

export function compose(args, options) {
	return run("docker", ["compose", "-f", composeFile, ...args], options);
}

export function readBackendEnvironment() {
	const contents = readFileSync(`${root}infra/local/backend.env.local`, "utf8");
	return Object.fromEntries(
		contents
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const index = line.indexOf("=");
				return [line.slice(0, index), line.slice(index + 1)];
			}),
	);
}

export function fail(error) {
	console.error(error instanceof Error ? error.message : "Local infrastructure command failed.");
	process.exitCode = 1;
}
