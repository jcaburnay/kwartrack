import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { waitForHttpReady } from "./readiness.mjs";

async function withServer(handler, run) {
	const server = createServer(handler);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	try {
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
}

test("a proxy warming up with 503 is retried until actual HTTP readiness", async () => {
	let calls = 0;
	await withServer(
		(_, response) => {
			response.writeHead(++calls < 3 ? 503 : 200);
			response.end("ready");
		},
		async (url) => {
			const response = await waitForHttpReady(url, { intervalMs: 5, timeoutMs: 1_000 });
			assert.equal(await response.text(), "ready");
			assert.equal(calls, 3);
		},
	);
});

test("persistent unavailability ends in a bounded failure", async () => {
	await withServer(
		(_, response) => {
			response.writeHead(503);
			response.end();
		},
		async (url) => {
			await assert.rejects(waitForHttpReady(url, { intervalMs: 5, timeoutMs: 100 }), /timed out/);
		},
	);
});

test("an unsupported route fails without waiting for readiness", async () => {
	let calls = 0;
	await withServer(
		(_, response) => {
			calls++;
			response.writeHead(404);
			response.end();
		},
		async (url) => {
			await assert.rejects(waitForHttpReady(url, { intervalMs: 5, timeoutMs: 1_000 }), /HTTP 404/);
			assert.equal(calls, 1);
		},
	);
});
