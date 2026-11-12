import { chmodSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { endpoint, fail, root } from "../infra/common.mjs";
import { authSettings } from "./cognito.mjs";
import { seedFixtures } from "./fixtures.mjs";

export function setupAuth() {
	const settings = authSettings();
	const subjects = seedFixtures(settings);
	const values = {
		COGNITO_ENDPOINT: endpoint,
		COGNITO_CONTAINER_ENDPOINT: "http://floci:4566",
		COGNITO_USER_POOL_ID: settings.poolId,
		COGNITO_CLIENT_ID: settings.clientId,
		COGNITO_ISSUER: settings.issuer,
		COGNITO_JWKS_URL: settings.jwksUrl,
		COGNITO_CONTAINER_JWKS_URL: `${settings.issuer}/.well-known/jwks.json`,
	};
	const file = `${root}infra/local/auth.env.local`;
	writeFileSync(
		file,
		`${Object.entries(values)
			.map(([key, value]) => `${key}=${value}`)
			.join("\n")}\n`,
		{ mode: 0o600 },
	);
	chmodSync(file, 0o600);
	return { settings, subjects };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		setupAuth();
		console.log(
			"Local Alice/Bob fixtures prepared; public configuration written to infra/local/auth.env.local.",
		);
	} catch (error) {
		fail(error);
	}
}
