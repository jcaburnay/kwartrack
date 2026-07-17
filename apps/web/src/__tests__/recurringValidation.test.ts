import { describe, expect, it } from "vitest";
import { type RecurringInput, validateRecurring } from "../utils/recurringValidation";

function base(overrides: Partial<RecurringInput> = {}): RecurringInput {
	return {
		service: "Spotify",
		amountCentavos: 279_00,
		type: "expense",
		tagId: "tag-1",
		fromAccountId: "acc-1",
		toAccountId: null,
		feeCentavos: null,
		description: "",
		date: "2026-04-26",
		interval: "monthly",
		firstOccurrenceDate: "2026-04-26",
		remainingOccurrences: null,
		...overrides,
	};
}

describe("validateRecurring — recurring-specific rules", () => {
	it("accepts a valid expense subscription", () => {
		expect(validateRecurring(base()).ok).toBe(true);
	});

	it("rejects empty service name", () => {
		const r = validateRecurring(base({ service: "" }));
		expect(r).toEqual({ ok: false, field: "service", message: "Service name is required" });
	});

	it("rejects whitespace-only service name", () => {
		const r = validateRecurring(base({ service: "   " }));
		expect(r).toEqual({ ok: false, field: "service", message: "Service name is required" });
	});

	it("rejects service name over 80 characters", () => {
		const r = validateRecurring(base({ service: "x".repeat(81) }));
		expect(r).toEqual({
			ok: false,
			field: "service",
			message: "Service name must be 80 characters or fewer",
		});
	});

	it("accepts service name at exactly 80 characters", () => {
		expect(validateRecurring(base({ service: "x".repeat(80) })).ok).toBe(true);
	});

	it("rejects missing schedule (firstOccurrenceDate)", () => {
		const r = validateRecurring(base({ firstOccurrenceDate: "" }));
		expect(r).toEqual({
			ok: false,
			field: "firstOccurrenceDate",
			message: "Schedule (first occurrence) is required",
		});
	});

	it("rejects zero remaining_occurrences", () => {
		const r = validateRecurring(base({ remainingOccurrences: 0 }));
		expect(r.ok).toBe(false);
	});

	it("rejects fractional remaining_occurrences", () => {
		const r = validateRecurring(base({ remainingOccurrences: 1.5 }));
		expect(r.ok).toBe(false);
	});

	it("rejects negative remaining_occurrences", () => {
		const r = validateRecurring(base({ remainingOccurrences: -1 }));
		expect(r.ok).toBe(false);
	});

	it("accepts null remaining_occurrences (open-ended subscription)", () => {
		expect(validateRecurring(base({ remainingOccurrences: null })).ok).toBe(true);
	});

	it("accepts positive remaining_occurrences", () => {
		expect(validateRecurring(base({ remainingOccurrences: 24 })).ok).toBe(true);
	});
});
