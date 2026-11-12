import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { endpoint, localEnvironment, terraform } from "../infra/common.mjs";

export class CognitoError extends Error {
	constructor(operation, code) {
		super(`${operation}: ${code}`);
		this.code = code;
	}
}

export function cognito(operation, input) {
	const env = localEnvironment();
	const temporary = mkdtempSync(join(tmpdir(), "kwartrack-auth-"));
	try {
		const file = join(temporary, "input.json");
		writeFileSync(file, JSON.stringify(input), { mode: 0o600 });
		const result = spawnSync(
			"aws",
			[
				"--endpoint-url",
				endpoint,
				"--region",
				"us-east-1",
				"--cli-connect-timeout",
				"2",
				"--cli-read-timeout",
				"5",
				"cognito-idp",
				operation,
				"--cli-input-json",
				`file://${file}`,
				"--output",
				"json",
			],
			{ env, encoding: "utf8", timeout: 10000 },
		);
		if (result.error || result.status !== 0) {
			const code =
				result.stderr?.match(/An error occurred \((\w+)\)/)?.[1] ?? "LocalOperationFailed";
			throw new CognitoError(operation, code);
		}
		return JSON.parse(result.stdout.trim() || "{}");
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}

export function authSettings() {
	const outputs = JSON.parse(terraform(["output", "-json"], { capture: true }));
	const poolId = outputs.cognito_user_pool_id?.value;
	const clientId = outputs.cognito_client_id?.value;
	if (
		typeof poolId !== "string" ||
		!/^us-east-1_[A-Za-z0-9-]+$/.test(poolId) ||
		typeof clientId !== "string" ||
		!/^[A-Za-z0-9_-]+$/.test(clientId)
	) {
		throw new Error("Local Cognito outputs are missing or invalid; run local:infra:setup.");
	}
	const issuer = `http://floci:4566/${poolId}`;
	if (outputs.cognito_issuer?.value !== issuer) throw new Error("Unexpected local Cognito issuer.");
	return { poolId, clientId, issuer, jwksUrl: `${endpoint}/${poolId}/.well-known/jwks.json` };
}
