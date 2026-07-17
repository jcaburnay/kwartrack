import { describe, expect, it } from "vitest";
import { computeShareCentavos } from "../utils/splitMath";

// `rows` is non-payer participants only. The payer's share is total − Σ(returned)
// and is computed by the caller (SplitForm/SplitParticipantList).

describe("computeShareCentavos", () => {
	it("equal: 30000 / 3 friends → each 7500 (payer's residual = 7500)", () => {
		expect(
			computeShareCentavos({
				method: "equal",
				totalCentavos: 30000,
				rows: [{ input: null }, { input: null }, { input: null }],
			}),
		).toEqual([7500, 7500, 7500]);
	});

	it("equal: 10000 / 2 friends → each 3333 (payer absorbs 3334 residual)", () => {
		// 10000 / 3 people = 3333 each, remainder 1 → payer = 3334.
		expect(
			computeShareCentavos({
				method: "equal",
				totalCentavos: 10000,
				rows: [{ input: null }, { input: null }],
			}),
		).toEqual([3333, 3333]);
	});

	it("exact: friends [3000, 3000] over 10000 → [3000, 3000] (payer = 4000)", () => {
		expect(
			computeShareCentavos({
				method: "exact",
				totalCentavos: 10000,
				rows: [{ input: 3000 }, { input: 3000 }],
			}),
		).toEqual([3000, 3000]);
	});

	it("exact: returns null when sum exceeds total", () => {
		expect(
			computeShareCentavos({
				method: "exact",
				totalCentavos: 10000,
				rows: [{ input: 6000 }, { input: 6000 }],
			}),
		).toBeNull();
	});

	it("exact: returns null when any input is 0 or negative", () => {
		expect(
			computeShareCentavos({
				method: "exact",
				totalCentavos: 10000,
				rows: [{ input: 5000 }, { input: 0 }],
			}),
		).toBeNull();
		expect(
			computeShareCentavos({
				method: "exact",
				totalCentavos: 10000,
				rows: [{ input: 5000 }, { input: -1 }],
			}),
		).toBeNull();
	});

	it("percentage: friends [33, 34] over 10000 → [3300, 3400] (payer = 3300)", () => {
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 10000,
				rows: [{ input: 33 }, { input: 34 }],
			}),
		).toEqual([3300, 3400]);
	});

	it("percentage: 33.33% × 100 — friends [33.33] → [33] (payer absorbs 67c residual)", () => {
		// round(100 × 33.33 / 100) = 33; payer = 100 − 33 = 67.
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 100,
				rows: [{ input: 33.33 }],
			}),
		).toEqual([33]);
	});

	it("percentage: returns null when sum exceeds 100", () => {
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 10000,
				rows: [{ input: 60 }, { input: 50 }],
			}),
		).toBeNull();
	});

	it("percentage: returns null when any input is 0 or negative", () => {
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 10000,
				rows: [{ input: 50 }, { input: 0 }],
			}),
		).toBeNull();
	});

	it("shares: friends [2, 3] over 30000 → [10000, 15000] (divisor 6, payer = 5000)", () => {
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 30000,
				rows: [{ input: 2 }, { input: 3 }],
			}),
		).toEqual([10000, 15000]);
	});

	it("shares: friends [1, 1] over 10000 → [3333, 3333] (divisor 3, payer = 3334)", () => {
		// Equal-mode equivalence when all weights are 1.
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 10000,
				rows: [{ input: 1 }, { input: 1 }],
			}),
		).toEqual([3333, 3333]);
	});

	it("shares: returns null when any input is 0 or negative", () => {
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 10000,
				rows: [{ input: 1 }, { input: 0 }],
			}),
		).toBeNull();
	});

	it("shares: returns null when an input is non-integer", () => {
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 10000,
				rows: [{ input: 1.5 }, { input: 1 }],
			}),
		).toBeNull();
	});

	it("returns null for empty rows", () => {
		expect(computeShareCentavos({ method: "equal", totalCentavos: 1000, rows: [] })).toBeNull();
	});

	it("returns null for zero or negative total", () => {
		expect(
			computeShareCentavos({ method: "equal", totalCentavos: 0, rows: [{ input: null }] }),
		).toBeNull();
		expect(
			computeShareCentavos({ method: "equal", totalCentavos: -100, rows: [{ input: null }] }),
		).toBeNull();
	});
});
