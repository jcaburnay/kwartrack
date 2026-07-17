import { describe, expect, it } from "vitest";
import { handleWorkerRequest, type WorkerEnv } from "./worker.js";

const env: WorkerEnv = {
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
	MCP_PUBLIC_URL: "https://mcp.kwartrack.com",
};

describe("Cloudflare Worker entry point", () => {
	it("serves a public health check", async () => {
		const response = await handleWorkerRequest(
			new Request("https://mcp.kwartrack.com/health"),
			env,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok", service: "kwartrack-mcp" });
	});

	it("publishes OAuth protected-resource discovery metadata", async () => {
		const response = await handleWorkerRequest(
			new Request("https://mcp.kwartrack.com/.well-known/oauth-protected-resource"),
			env,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			resource: "https://mcp.kwartrack.com",
			authorization_servers: ["https://example.supabase.co/auth/v1"],
			scopes_supported: ["openid", "email", "profile"],
		});
	});

	it("challenges unauthenticated MCP requests with discoverable OAuth metadata", async () => {
		const response = await handleWorkerRequest(
			new Request("https://mcp.kwartrack.com/mcp", { method: "POST" }),
			env,
		);
		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain(
			"https://mcp.kwartrack.com/.well-known/oauth-protected-resource",
		);
	});
});
