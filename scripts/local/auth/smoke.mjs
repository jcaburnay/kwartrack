import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { fail } from "../infra/common.mjs";
import { cognito } from "./cognito.mjs";
import { checkOwnership, fixturePassword, fixtureUsers } from "./fixtures.mjs";
import { setupAuth } from "./setup.mjs";

try {
	const first = setupAuth();
	const second = setupAuth();
	assert.deepEqual(second.subjects, first.subjects);
	assert.equal(new Set(Object.values(first.subjects)).size, 2);
	const client = checkOwnership(first.settings);
	assert.equal(client.AccessTokenValidity, 15);
	assert.equal(client.TokenValidityUnits.AccessToken, "minutes");
	const response = await fetch(first.settings.jwksUrl, { signal: AbortSignal.timeout(5000) });
	assert.equal(response.status, 200);
	const jwks = await response.json();
	for (const username of fixtureUsers) {
		const auth = cognito("initiate-auth", {
			ClientId: first.settings.clientId,
			AuthFlow: "USER_PASSWORD_AUTH",
			AuthParameters: { USERNAME: username, PASSWORD: fixturePassword },
		}).AuthenticationResult;
		const [header, payload, signature] = auth.AccessToken.split(".");
		const metadata = JSON.parse(Buffer.from(header, "base64url").toString());
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
		assert.equal(metadata.alg, "RS256");
		const key = jwks.keys.find((candidate) => candidate.kid === metadata.kid);
		assert.ok(key);
		assert.equal(
			verify(
				"RSA-SHA256",
				Buffer.from(`${header}.${payload}`),
				createPublicKey({ key, format: "jwk" }),
				Buffer.from(signature, "base64url"),
			),
			true,
		);
		assert.equal(claims.sub, first.subjects[username]);
		assert.equal(claims.iss, first.settings.issuer);
		assert.equal(claims.client_id, first.settings.clientId);
		assert.equal(claims.token_use, "access");
		assert.equal(claims.exp - claims.iat, 900);
		assert.ok(claims.exp > Math.floor(Date.now() / 1000));
	}
	console.log(
		"PASS repeated setup preserves two distinct subjects; Alice/Bob authenticate with signed 900-second access tokens.",
	);
} catch (error) {
	fail(error);
}
