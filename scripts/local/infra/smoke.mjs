import assert from "node:assert/strict";
import { aws, fail, localEnvironment, terraform } from "./common.mjs";
import { waitForHttpReady } from "./readiness.mjs";

try {
	localEnvironment();
	const outputs = JSON.parse(terraform(["output", "-json"], { capture: true }));
	const apiId = outputs.api_id.value;
	const albHost = outputs.alb_dns_name.value;
	if (!/^[a-f0-9]+$/.test(apiId) || !/^[a-zA-Z0-9.-]+$/.test(albHost))
		throw new Error("Invalid local routing outputs.");
	const gateway = `http://127.0.0.1:4566/execute-api/${apiId}/$default`;
	for (const [name, base, headers] of [
		["direct", "http://127.0.0.1:3000", {}],
		["ALB", "http://127.0.0.1:8080", { Host: albHost }],
		["gateway", gateway, {}],
	]) {
		for (const path of ["/health/live", "/health/ready"]) {
			const response = await waitForHttpReady(`${base}${path}`, {
				headers: { ...headers, "X-Request-Id": "local-route-smoke" },
			});
			assert.equal(response.status, 200, `${name}${path} must return 200`);
			assert.equal(response.headers.get("x-request-id"), "local-route-smoke");
			assert.match(response.headers.get("x-api-instance") ?? "", /^api-[12]$/);
			assert.equal((await response.json()).status, "ok", `${name}${path} must be healthy`);
		}
		const missing = await fetch(`${base}/not-a-route?probe=a%20b&probe=two`, {
			headers,
			signal: AbortSignal.timeout(10_000),
		});
		assert.equal(missing.status, 404, `${name} must preserve backend status`);
		const message = (await missing.json()).message;
		assert.match(message, /^Cannot GET /);
		const forwarded = new URL(message.slice("Cannot GET ".length), "http://local.invalid");
		assert.equal(forwarded.pathname, "/not-a-route");
		assert.deepEqual(
			forwarded.searchParams.getAll("probe"),
			["a b", "two"],
			`${name} must preserve repeated query values`,
		);
		console.log(`${name}: live/ready 200, missing route 404`);
	}
	const integrations = aws(["apigatewayv2", "get-integrations", "--api-id", apiId]).Items;
	assert.equal(integrations.length, 1);
	assert.equal(integrations[0].ConnectionType, "VPC_LINK");
	assert.match(integrations[0].IntegrationUri, /^arn:aws:elasticloadbalancing:.*:listener\/app\//);
	console.log("Gateway configuration references VPC_LINK and the ALB listener ARN.");
} catch (error) {
	fail(error);
}
