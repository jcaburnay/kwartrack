import { describe, expect, it } from "vitest";
import { InvalidJsonBodyError, RequestBodyTooLargeError, readBoundedJsonBody } from "./auth.js";
import { isApprovedOAuthClaims } from "./supabase.js";

const approvedClientId = "f5d50b9f-94ce-4aa9-b598-ade3829361f9";

describe("OAuth claim authorization", () => {
	it("accepts only the approved ChatGPT client", () => {
		expect(isApprovedOAuthClaims({ client_id: approvedClientId }, approvedClientId)).toBe(true);
	});

	it("rejects another OAuth client", () => {
		expect(isApprovedOAuthClaims({ client_id: "unapproved-client" }, approvedClientId)).toBe(false);
	});

	it("rejects a normal Supabase browser session at the MCP boundary", () => {
		expect(isApprovedOAuthClaims({ role: "authenticated" }, approvedClientId)).toBe(false);
	});
});

describe("bounded MCP request bodies", () => {
	it("reads valid JSON when Content-Length is absent", async () => {
		const request = new Request("https://mcp.kwartrack.com/mcp", {
			method: "POST",
			body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
		});
		expect(request.headers.get("Content-Length")).toBeNull();
		expect(await readBoundedJsonBody(request)).toMatchObject({ method: "tools/list" });
	});

	it("rejects an oversized body when Content-Length is absent", async () => {
		const request = new Request("https://mcp.kwartrack.com/mcp", {
			method: "POST",
			body: `"${"x".repeat(1_000_001)}"`,
		});
		expect(request.headers.get("Content-Length")).toBeNull();
		await expect(readBoundedJsonBody(request)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
	});

	it("rejects malformed JSON", async () => {
		const request = new Request("https://mcp.kwartrack.com/mcp", {
			method: "POST",
			body: "not-json",
		});
		await expect(readBoundedJsonBody(request)).rejects.toBeInstanceOf(InvalidJsonBodyError);
	});
});
