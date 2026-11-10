import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { aws, fail, root } from "./common.mjs";

export function generateEnvironment() {
	const result = aws([
		"rds",
		"describe-db-instances",
		"--db-instance-identifier",
		"kwartrack-api-local",
	]);
	const instance = result.DBInstances?.[0];
	const port = instance?.Endpoint?.Port;
	if (
		instance?.DBInstanceStatus !== "available" ||
		instance?.Endpoint?.Address !== "floci" ||
		!Number.isInteger(port) ||
		port < 7001 ||
		port > 7004
	) {
		throw new Error("RDS did not return an available, allowlisted Floci data endpoint.");
	}
	const { database_password: password } = JSON.parse(
		readFileSync(`${root}infra/terraform/local/local.auto.tfvars.json`, "utf8"),
	);
	if (typeof password !== "string" || !/^[a-f0-9]{48}$/.test(password))
		throw new Error("Local database credential file is invalid.");
	const credentials = `kwartrack:${password}`;
	const env = {
		API_HOST_DATABASE_URL: `postgresql://${credentials}@127.0.0.1:${port}/kwartrack_api`,
		API_CONTAINER_DATABASE_URL: `postgresql://${credentials}@floci:${port}/kwartrack_api`,
	};
	writeFileSync(
		`${root}infra/local/backend.env.local`,
		`${Object.entries(env)
			.map(([key, value]) => `${key}=${value}`)
			.join("\n")}\n`,
		{ mode: 0o600 },
	);
	return env;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		generateEnvironment();
		console.log(
			"Wrote restricted infra/local/backend.env.local using the discovered RDS endpoint.",
		);
	} catch (error) {
		fail(error);
	}
}
