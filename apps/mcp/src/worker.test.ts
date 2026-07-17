import { describe, expect, it } from "vitest";
import { handleWorkerRequest, type WorkerEnv } from "./worker.js";

const env: WorkerEnv = {
	SUPABASE_URL: "https://example.supabase.co",
	SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
	MCP_ALLOWED_OAUTH_CLIENT_ID: "f5d50b9f-94ce-4aa9-b598-ade3829361f9",
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

	it("rejects untrusted browser origins", async () => {
		const response = await handleWorkerRequest(
			new Request("https://mcp.kwartrack.com/mcp", {
				method: "POST",
				headers: { Origin: "https://attacker.example" },
			}),
			env,
		);
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("echoes a trusted ChatGPT origin", async () => {
		const response = await handleWorkerRequest(
			new Request("https://mcp.kwartrack.com/mcp", {
				method: "POST",
				headers: { Origin: "https://chatgpt.com" },
			}),
			env,
		);
		expect(response.status).toBe(401);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://chatgpt.com");
	});

	it("rejects oversized MCP requests before parsing the body", async () => {
		const response = await handleWorkerRequest(
			new Request("https://mcp.kwartrack.com/mcp", {
				method: "POST",
				headers: { "Content-Length": "1000001" },
			}),
			env,
		);
		expect(response.status).toBe(413);
	});
});
