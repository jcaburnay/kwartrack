import { describe, expect, it } from "vitest";
import { safeAuthNext } from "../utils/authRedirect";

describe("safeAuthNext", () => {
	it("allows an internal OAuth continuation path", () => {
		expect(safeAuthNext("?next=%2Foauth%2Fauthorize%3Fauthorization_id%3Drequest-123")).toBe(
			"/oauth/authorize?authorization_id=request-123",
		);
	});

	it("rejects external and protocol-relative redirects", () => {
		expect(safeAuthNext("?next=https%3A%2F%2Fevil.example")).toBe("/");
		expect(safeAuthNext("?next=%2F%2Fevil.example")).toBe("/");
	});
});
