import { describe, expect, it } from "vitest";
import { validatePerson } from "../utils/personValidation";

describe("validatePerson", () => {
	it("rejects empty name", () => {
		expect(validatePerson("")).toEqual({ ok: false, message: "Name is required" });
		expect(validatePerson("   ")).toEqual({ ok: false, message: "Name is required" });
	});
	it("rejects names longer than 80 chars", () => {
		const long = "a".repeat(81);
		expect(validatePerson(long)).toEqual({
			ok: false,
			message: "Name must be 80 characters or fewer",
		});
	});
	it("accepts names within bounds", () => {
		expect(validatePerson("Alice")).toEqual({ ok: true });
		expect(validatePerson("a".repeat(80))).toEqual({ ok: true });
	});
});
