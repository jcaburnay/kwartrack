import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { aws, compose, fail, readBackendEnvironment, terraform } from "./common.mjs";

async function waitForHealth(targetGroupArn, expectedHealthy) {
	for (let attempt = 0; attempt < 30; attempt++) {
		const targets = aws([
			"elbv2",
			"describe-target-health",
			"--target-group-arn",
			targetGroupArn,
		]).TargetHealthDescriptions;
		const healthy = targets.filter((target) => target.TargetHealth.State === "healthy").length;
		if (healthy === expectedHealthy) return;
		await setTimeout(1_000);
	}
	throw new Error(`ALB did not report ${expectedHealthy} healthy targets within 30 seconds.`);
}

async function observedInstances(apiId, count) {
	const found = new Set();
	for (let index = 0; index < count; index++) {
		const response = await fetch(
			`http://127.0.0.1:4566/execute-api/${apiId}/$default/health/ready`,
			{ signal: AbortSignal.timeout(10_000) },
		);
		assert.equal(response.status, 200);
		found.add(response.headers.get("x-api-instance"));
	}
	return found;
}

let secondStarted = false;
try {
	const env = readBackendEnvironment();
	compose(["--profile", "api", "--profile", "smoke", "up", "-d", "--build", "api", "api-second"], {
		env,
	});
	secondStarted = true;
	terraform(["apply", "-input=false", "-auto-approve", "-var=enable_second_api=true"], {
		capture: true,
	});
	const outputs = JSON.parse(terraform(["output", "-json"], { capture: true }));
	const targetGroupArn = outputs.target_group_arn.value;
	const apiId = outputs.api_id.value;
	await waitForHealth(targetGroupArn, 2);
	assert.deepEqual(await observedInstances(apiId, 20), new Set(["api-1", "api-2"]));
	console.log("Two-target gateway requests reached api-1 and api-2.");
	compose(["--profile", "smoke", "stop", "api-second"]);
	await waitForHealth(targetGroupArn, 1);
	assert.deepEqual(await observedInstances(apiId, 12), new Set(["api-1"]));
	console.log("Stopped target is unhealthy; gateway continues through api-1.");
	compose(["--profile", "smoke", "up", "-d", "api-second"], { env });
	await waitForHealth(targetGroupArn, 2);
	assert.deepEqual(await observedInstances(apiId, 20), new Set(["api-1", "api-2"]));
	console.log("Restarted target rejoined without changing its registered address.");
} catch (error) {
	fail(error);
} finally {
	if (secondStarted) {
		try {
			terraform(["apply", "-input=false", "-auto-approve", "-var=enable_second_api=false"], {
				capture: true,
			});
			compose(["--profile", "smoke", "stop", "api-second"]);
		} catch (error) {
			fail(error);
		}
	}
}
