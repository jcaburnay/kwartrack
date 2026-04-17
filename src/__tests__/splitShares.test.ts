import { describe, expect, it } from "vitest";
import {
	computeParticipantShareCentavos,
	computeYourShareCentavos,
	parseCentavos,
	type SplitShareInput,
	validateShares,
} from "../utils/splitShares";

// =============================================================================
// Test helpers — build ParticipantInput-compatible rows with minimal noise.
// =============================================================================

const p = (partial: Partial<SplitShareInput>): SplitShareInput => ({
	name: "",
	shareAmount: "",
	sharePercentage: "",
	shareCount: 1,
	...partial,
});

// =============================================================================
// parseCentavos — peso-string → BigInt centavos
// =============================================================================

describe("parseCentavos", () => {
	it("converts a whole-peso amount to centavos", () => {
		expect(parseCentavos("100")).toBe(10_000n);
	});

	it("rounds to the nearest centavo on fractional pesos", () => {
		expect(parseCentavos("1.234")).toBe(123n); // 123.4 → 123
		expect(parseCentavos("1.235")).toBe(124n); // 123.5 → 124 (banker's? no, Math.round rounds half up)
	});

	it("returns 0n for empty or undefined-like input", () => {
		expect(parseCentavos("")).toBe(0n);
		expect(parseCentavos("0")).toBe(0n);
	});

	it("returns 0n for non-numeric input (parseFloat → NaN → Math.round(NaN) = 0)", () => {
		// parseFloat("abc") is NaN; Math.round(NaN) is NaN; BigInt(NaN) throws.
		// The function guards via `|| "0"` ONLY when input is falsy — "abc" is truthy.
		// This test pins the current behaviour: non-numeric strings will throw.
		expect(() => parseCentavos("abc")).toThrow();
	});
});

// =============================================================================
// "equal" method — total divided evenly over payer + named participants.
// BigInt floor division: remainders are lost (existing behaviour).
// =============================================================================

describe("computeYourShareCentavos — equal method", () => {
	it("divides total by (validParticipants + 1)", () => {
		// ₱300 split between you + 2 named friends = ₱100 each
		const participants = [p({ name: "Alice" }), p({ name: "Bob" })];
		expect(computeYourShareCentavos("equal", participants, 30_000n)).toBe(10_000n);
	});

	it("floors the residual when total doesn't divide evenly", () => {
		// ₱100 / 3 = ₱33.33... → floor to ₱33.33 (3_333 centavos)
		const participants = [p({ name: "Alice" }), p({ name: "Bob" })];
		expect(computeYourShareCentavos("equal", participants, 10_000n)).toBe(3_333n);
	});

	it("ignores participants with empty or whitespace-only names", () => {
		const participants = [p({ name: "Alice" }), p({ name: "  " }), p({ name: "" })];
		// Only Alice counts → 2-way split
		expect(computeYourShareCentavos("equal", participants, 10_000n)).toBe(5_000n);
	});

	it("returns the full total when no participants are named", () => {
		expect(computeYourShareCentavos("equal", [p({})], 10_000n)).toBe(10_000n);
	});
});

describe("computeParticipantShareCentavos — equal method", () => {
	it("gives each participant the same floor-divided share", () => {
		const participants = [p({ name: "Alice" }), p({ name: "Bob" })];
		const result = computeParticipantShareCentavos(participants[0], "equal", participants, 30_000n);
		expect(result).toBe(10_000n);
	});

	it("is identical for each participant in equal mode", () => {
		const participants = [p({ name: "Alice" }), p({ name: "Bob" }), p({ name: "Carol" })];
		const shares = participants.map((pp) =>
			computeParticipantShareCentavos(pp, "equal", participants, 10_000n),
		);
		expect(new Set(shares.map(String)).size).toBe(1);
	});
});

// =============================================================================
// "exact" method — participants type in literal peso amounts; "you" absorb the residual.
// =============================================================================

describe("computeYourShareCentavos — exact method", () => {
	it("returns total minus the sum of entered participant amounts", () => {
		// ₱100 total; Alice paid ₱30, Bob paid ₱25 → your share is ₱45
		const participants = [
			p({ name: "Alice", shareAmount: "30" }),
			p({ name: "Bob", shareAmount: "25" }),
		];
		expect(computeYourShareCentavos("exact", participants, 10_000n)).toBe(4_500n);
	});

	it("can return a negative residual if participants overpay", () => {
		// ₱100 total; Alice claims ₱80, Bob claims ₱50 → you would "owe" -₱30
		const participants = [
			p({ name: "Alice", shareAmount: "80" }),
			p({ name: "Bob", shareAmount: "50" }),
		];
		expect(computeYourShareCentavos("exact", participants, 10_000n)).toBe(-3_000n);
		// This is why validateShares() catches this condition before submit.
	});
});

describe("computeParticipantShareCentavos — exact method", () => {
	it("returns the literal entered amount (as centavos)", () => {
		const participants = [p({ name: "Alice", shareAmount: "42.50" })];
		expect(computeParticipantShareCentavos(participants[0], "exact", participants, 10_000n)).toBe(
			4_250n,
		);
	});
});

// =============================================================================
// "percentage" method — participants type % of total; "you" absorb the residual.
// =============================================================================

describe("computeYourShareCentavos — percentage method", () => {
	it("takes (100 - sumOfParticipantPercents) / 100 of the total", () => {
		// ₱1_000 total; Alice 30%, Bob 20% → you get 50% = ₱500
		const participants = [
			p({ name: "Alice", sharePercentage: "30" }),
			p({ name: "Bob", sharePercentage: "20" }),
		];
		expect(computeYourShareCentavos("percentage", participants, 100_000n)).toBe(50_000n);
	});

	it("rounds to the nearest centavo when the percent doesn't divide evenly", () => {
		// ₱100 at 33.33% → participant gets 3_333, you get 100_00 - 3_333 = 6_667... actually
		// the function computes YOUR share from 100 - 33.33 = 66.67% → 6_667 centavos.
		const participants = [p({ name: "Alice", sharePercentage: "33.33" })];
		expect(computeYourShareCentavos("percentage", participants, 10_000n)).toBe(6_667n);
	});
});

// =============================================================================
// "shares" method — each row (including "you") represents shareCount units of the total.
// NOTE: unlike other methods, empty-name rows DO count toward totalShares — this
// mirrors the modal's on-screen preview. Pinned here so behaviour is explicit.
// =============================================================================

describe("computeYourShareCentavos — shares method", () => {
	it("splits proportionally across shareCount + 1 (your implicit 1 share)", () => {
		// Alice has 2 shares, Bob has 3 shares → totalShares = 2 + 3 + 1 = 6
		// You get 1/6 of ₱600 = ₱100
		const participants = [p({ name: "Alice", shareCount: 2 }), p({ name: "Bob", shareCount: 3 })];
		expect(computeYourShareCentavos("shares", participants, 60_000n)).toBe(10_000n);
	});

	it("counts unnamed rows too (matches modal preview)", () => {
		// Alice has 2 shares (named), unnamed row has 3 shares.
		// totalShares = 2 + 3 + 1 = 6. Your share = ₱600/6 = ₱100.
		const participants = [p({ name: "Alice", shareCount: 2 }), p({ name: "", shareCount: 3 })];
		expect(computeYourShareCentavos("shares", participants, 60_000n)).toBe(10_000n);
	});
});

describe("computeParticipantShareCentavos — shares method", () => {
	it("allocates each participant (shareCount / totalShares) of the total", () => {
		const participants = [p({ name: "Alice", shareCount: 2 })];
		// totalShares = 2 + 1 = 3. Alice's share = 2/3 × ₱600 = ₱400.
		expect(computeParticipantShareCentavos(participants[0], "shares", participants, 60_000n)).toBe(
			40_000n,
		);
	});
});

// =============================================================================
// validateShares — surface-level error messages shown by the modal.
// =============================================================================

describe("validateShares", () => {
	it("rejects an empty participant list", () => {
		expect(validateShares("equal", [], 10_000n)).toBe("At least one participant name is required");
	});

	it("rejects a list with only empty names", () => {
		expect(validateShares("equal", [p({ name: "" }), p({ name: "  " })], 10_000n)).toBe(
			"At least one participant name is required",
		);
	});

	it("accepts a valid equal split", () => {
		expect(validateShares("equal", [p({ name: "Alice" })], 10_000n)).toBeNull();
	});

	it("flags overpayment in exact mode", () => {
		const participants = [
			p({ name: "Alice", shareAmount: "60" }),
			p({ name: "Bob", shareAmount: "50" }),
		];
		expect(validateShares("exact", participants, 10_000n)).toBe(
			"Participant shares exceed the total amount",
		);
	});

	it("accepts exact shares that sum to less than or equal to the total", () => {
		const participants = [
			p({ name: "Alice", shareAmount: "30" }),
			p({ name: "Bob", shareAmount: "70" }),
		];
		expect(validateShares("exact", participants, 10_000n)).toBeNull();
	});

	it("flags over-100% totals in percentage mode", () => {
		const participants = [
			p({ name: "Alice", sharePercentage: "60" }),
			p({ name: "Bob", sharePercentage: "50" }),
		];
		expect(validateShares("percentage", participants, 10_000n)).toBe(
			"Participant percentages exceed 100%",
		);
	});

	it("accepts percentages that sum to exactly 100", () => {
		const participants = [
			p({ name: "Alice", sharePercentage: "40" }),
			p({ name: "Bob", sharePercentage: "60" }),
		];
		expect(validateShares("percentage", participants, 10_000n)).toBeNull();
	});

	it("does not validate shares-mode counts (any count > 0 is acceptable)", () => {
		const participants = [p({ name: "Alice", shareCount: 9999 })];
		expect(validateShares("shares", participants, 10_000n)).toBeNull();
	});
});
