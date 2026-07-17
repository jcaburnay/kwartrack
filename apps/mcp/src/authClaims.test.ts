import { describe, expect, it } from "vitest";
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
