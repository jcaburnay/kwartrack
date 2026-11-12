import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeFile, endpoint, localEnvironment } from "../infra/common.mjs";

// A bounded local compatibility experiment, not the production JWT verifier.
const env = localEnvironment();
const temporary = mkdtempSync(join(tmpdir(), "kwartrack-auth-spike-"));
const inputFile = join(temporary, "input.json");
const username = "probe@kwartrack.local";
const password = `Local9!${randomBytes(18).toString("hex")}`;
let poolId;

function call(operation, input) {
	writeFileSync(inputFile, JSON.stringify(input), { mode: 0o600 });
	const response = spawnSync(
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
			`file://${inputFile}`,
			"--output",
			"json",
		],
		{ env, encoding: "utf8", timeout: 10000 },
	);
	if (response.error || response.status !== 0) {
		const code =
			response.stderr?.match(/An error occurred \((\w+)\)/)?.[1] ?? "LocalOperationFailed";
		throw new Error(`${operation}: ${code}`);
	}
	return JSON.parse(response.stdout.trim() || "{}");
}

function rejected(label, operation, input, code) {
	assert.throws(() => call(operation, input), new RegExp(`: ${code}$`));
	console.log(`PASS ${label}: ${code}`);
}

function decode(token) {
	const [header, payload, signature] = token.split(".");
	return {
		header: JSON.parse(Buffer.from(header, "base64url").toString()),
		claims: JSON.parse(Buffer.from(payload, "base64url").toString()),
		message: Buffer.from(`${header}.${payload}`),
		signature: Buffer.from(signature, "base64url"),
	};
}

async function json(url) {
	const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
	assert.equal(response.status, 200);
	return response.json();
}

try {
	poolId = call("create-user-pool", {
		PoolName: `kwartrack-auth-spike-${randomUUID()}`,
		UserPoolTags: { project: "kwartrack-backend-local", purpose: "disposable-auth-spike" },
		AutoVerifiedAttributes: ["email"],
		UsernameAttributes: ["email"],
	}).UserPool.Id;
	assert.match(poolId, /^[a-zA-Z0-9_-]+$/);
	const client = call("create-user-pool-client", {
		UserPoolId: poolId,
		ClientName: "disposable-public-client",
		GenerateSecret: false,
		ExplicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
		AccessTokenValidity: 15,
		IdTokenValidity: 15,
		RefreshTokenValidity: 1,
		TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes", RefreshToken: "days" },
		EnableTokenRevocation: true,
	}).UserPoolClient;
	assert.equal(client.ClientSecret, undefined);
	const clientId = client.ClientId;
	call("admin-create-user", {
		UserPoolId: poolId,
		Username: username,
		MessageAction: "SUPPRESS",
		UserAttributes: [
			{ Name: "email", Value: username },
			{ Name: "email_verified", Value: "true" },
		],
	});
	call("admin-set-user-password", {
		UserPoolId: poolId,
		Username: username,
		Password: password,
		Permanent: true,
	});
	const signIn = {
		ClientId: clientId,
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: { USERNAME: username, PASSWORD: password },
	};
	const auth = call("initiate-auth", signIn).AuthenticationResult;
	assert.ok(auth.AccessToken && auth.RefreshToken && auth.IdToken);
	const discovery = await json(`${endpoint}/${poolId}/.well-known/openid-configuration`);
	const keys = await json(`${endpoint}/${poolId}/.well-known/jwks.json`);
	const jwt = decode(auth.AccessToken);
	assert.equal(jwt.header.alg, "RS256");
	const key = keys.keys.find((candidate) => candidate.kid === jwt.header.kid);
	assert.ok(key);
	assert.equal(
		verify("RSA-SHA256", jwt.message, createPublicKey({ key, format: "jwk" }), jwt.signature),
		true,
	);
	assert.equal(jwt.claims.iss, discovery.issuer);
	assert.equal(jwt.claims.token_use, "access");
	assert.equal(jwt.claims.client_id, clientId);
	assert.match(jwt.claims.sub, /^[0-9a-f-]{36}$/);
	assert.equal(jwt.claims.exp - jwt.claims.iat, 900);
	assert.ok(jwt.claims.exp > Math.floor(Date.now() / 1000));
	console.log(
		`PASS access signature/claims: RS256; lifetime 900s; issuer ${discovery.issuer.replace(poolId, "<pool-id>")}`,
	);
	console.log(`Claim names only: ${Object.keys(jwt.claims).sort().join(", ")}`);
	console.log(
		`ID token type: ${decode(auth.IdToken).claims.token_use}; public client has no secret`,
	);

	const containerCode = `const base='http://floci:4566/${poolId}/.well-known/'; const d=await fetch(base+'openid-configuration').then(r=>r.json()); const k=await fetch(base+'jwks.json').then(r=>r.json()); console.log(JSON.stringify({issuer:d.issuer,kids:k.keys.map(x=>x.kid)}));`;
	const container = spawnSync(
		"docker",
		[
			"compose",
			"-f",
			composeFile,
			"exec",
			"-T",
			"api",
			"node",
			"--input-type=module",
			"-e",
			containerCode,
		],
		{ env, encoding: "utf8", timeout: 10000 },
	);
	assert.equal(container.status, 0, "container discovery probe must succeed");
	const containerData = JSON.parse(container.stdout);
	assert.equal(containerData.issuer, discovery.issuer);
	assert.deepEqual(
		containerData.kids,
		keys.keys.map((candidate) => candidate.kid),
	);
	console.log("PASS host/container discovery issuer and signing keys agree");

	rejected(
		"wrong password",
		"initiate-auth",
		{ ...signIn, AuthParameters: { USERNAME: username, PASSWORD: "Wrong9!Password" } },
		"NotAuthorizedException",
	);
	call("admin-disable-user", { UserPoolId: poolId, Username: username });
	rejected("disabled user", "initiate-auth", signIn, "NotAuthorizedException");
	call("admin-enable-user", { UserPoolId: poolId, Username: username });
	const refresh = {
		ClientId: clientId,
		AuthFlow: "REFRESH_TOKEN_AUTH",
		AuthParameters: { REFRESH_TOKEN: auth.RefreshToken },
	};
	assert.equal(
		decode(call("initiate-auth", refresh).AuthenticationResult.AccessToken).claims.sub,
		jwt.claims.sub,
	);
	console.log("PASS non-rotating refresh preserves user subject");
	call("revoke-token", { ClientId: clientId, Token: auth.RefreshToken });
	rejected("revoked refresh", "initiate-auth", refresh, "NotAuthorizedException");
	assert.equal(
		verify("RSA-SHA256", jwt.message, createPublicKey({ key, format: "jwk" }), jwt.signature),
		true,
	);
	console.log(
		"PASS revoked refresh does not change existing access JWT signature (expiry window remains)",
	);

	const origin = "http://127.0.0.1:5174";
	const preflight = await fetch(endpoint, {
		method: "OPTIONS",
		headers: {
			Origin: origin,
			"Access-Control-Request-Method": "POST",
			"Access-Control-Request-Headers":
				"content-type,x-amz-target,x-amz-user-agent,amz-sdk-invocation-id,amz-sdk-request",
		},
		signal: AbortSignal.timeout(5000),
	});
	assert.ok(preflight.ok);
	const allowedOrigin = preflight.headers.get("access-control-allow-origin");
	assert.equal(allowedOrigin, origin);
	assert.ok(
		preflight.headers
			.get("access-control-allow-methods")
			?.toUpperCase()
			.split(/\s*,\s*/)
			.includes("POST"),
	);
	const allowedHeaders =
		preflight.headers
			.get("access-control-allow-headers")
			?.toLowerCase()
			.split(/\s*,\s*/) ?? [];
	for (const header of [
		"content-type",
		"x-amz-target",
		"x-amz-user-agent",
		"amz-sdk-invocation-id",
		"amz-sdk-request",
	]) {
		assert.ok(allowedHeaders.includes(header), `preflight must allow ${header}`);
	}
	const denied = await fetch(endpoint, {
		method: "OPTIONS",
		headers: { Origin: "http://untrusted.invalid", "Access-Control-Request-Method": "POST" },
		signal: AbortSignal.timeout(5000),
	});
	assert.equal(denied.headers.get("access-control-allow-origin"), null);
	const publicCall = await fetch(endpoint, {
		method: "POST",
		headers: {
			Origin: origin,
			"Content-Type": "application/x-amz-json-1.1",
			"X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
		},
		body: JSON.stringify(signIn),
		signal: AbortSignal.timeout(5000),
	});
	assert.equal(publicCall.status, 200);
	assert.equal(publicCall.headers.get("access-control-allow-origin"), origin);
	console.log(
		`PASS origin-bearing public sign-in and preflight: allow-origin ${allowedOrigin}; allow-headers ${preflight.headers.get("access-control-allow-headers")}`,
	);

	const signupName = "signup@kwartrack.local";
	const signup = call("sign-up", {
		ClientId: clientId,
		Username: signupName,
		Password: password,
		UserAttributes: [{ Name: "email", Value: signupName }],
	});
	assert.equal(signup.UserConfirmed, false);
	assert.equal(signup.CodeDeliveryDetails?.DeliveryMedium, "EMAIL");
	console.log(
		`PASS public signup: confirmed=${signup.UserConfirmed}; delivery metadata=${Boolean(signup.CodeDeliveryDetails)}`,
	);
	call("resend-confirmation-code", { ClientId: clientId, Username: signupName });
	call("admin-confirm-sign-up", { UserPoolId: poolId, Username: signupName });
	assert.ok(
		call("initiate-auth", {
			...signIn,
			AuthParameters: { USERNAME: signupName, PASSWORD: password },
		}).AuthenticationResult.AccessToken,
	);
	console.log(
		"PASS resend request and admin-assisted signup confirmation; actual email-code delivery not tested",
	);
	const recovery = call("forgot-password", { ClientId: clientId, Username: username });
	assert.equal(recovery.CodeDeliveryDetails?.DeliveryMedium, "EMAIL");
	console.log(
		`PASS password-recovery request: delivery metadata=${Boolean(recovery.CodeDeliveryDetails)}; correct-code completion not tested`,
	);
	rejected(
		"invalid recovery code",
		"confirm-forgot-password",
		{
			ClientId: clientId,
			Username: username,
			ConfirmationCode: "invalid-code",
			Password: `Changed9!${randomBytes(18).toString("hex")}`,
		},
		"CodeMismatchException",
	);
	console.log(
		"KT-0010 compatibility experiment completed; no tokens or passwords written to evidence.",
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : "Local Cognito compatibility failed");
	process.exitCode = 1;
} finally {
	if (poolId) {
		try {
			call("delete-user-pool", { UserPoolId: poolId });
			console.log("Removed only the disposable spike pool and its synthetic users.");
		} catch {
			console.error("Disposable spike pool cleanup failed; inspect local Cognito resources.");
			process.exitCode = 1;
		}
	}
	rmSync(temporary, { recursive: true, force: true });
}
