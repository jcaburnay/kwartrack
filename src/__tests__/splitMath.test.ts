import { describe, expect, it } from "vitest";
import { computeShareCentavos } from "../utils/splitMath";

describe("computeShareCentavos", () => {
	it("equal: divides evenly when total is divisible", () => {
		expect(
			computeShareCentavos({
				method: "equal",
				totalCentavos: 30000,
				rows: [{ input: null }, { input: null }, { input: null }],
			}),
		).toEqual([10000, 10000, 10000]);
	});

	it("equal: payer (rows[0]) absorbs remainder cents", () => {
		// 100.00 / 3 = 33.33 with 0.01 remainder; payer gets 33.34.
		expect(
			computeShareCentavos({
				method: "equal",
				totalCentavos: 10000,
				rows: [{ input: null }, { input: null }, { input: null }],
			}),
		).toEqual([3334, 3333, 3333]);
	});

	it("exact: passes through user-supplied centavos as-is when sum matches total", () => {
		expect(
			computeShareCentavos({
				method: "exact",
				totalCentavos: 10000,
				rows: [{ input: 4000 }, { input: 3000 }, { input: 3000 }],
			}),
		).toEqual([4000, 3000, 3000]);
	});

	it("percentage: rounds proportionally; payer absorbs remainder", () => {
		// 33% of 10000 = 3300; 33% = 3300; 34% = 3400. Sum = 10000 already.
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 10000,
				rows: [{ input: 33 }, { input: 33 }, { input: 34 }],
			}),
		).toEqual([3300, 3300, 3400]);
	});

	it("percentage: payer absorbs rounding remainder when rounding leaves leftover cents", () => {
		// Total 100 centavos (₱1.00). 33.33% × 100 = 33.33 → round 33;
		// 33.34% × 100 = 33.34 → round 33. Three rows round to 33+33+33 = 99,
		// leaving 1 cent unaccounted; the payer absorbs it.
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 100,
				rows: [{ input: 33.33 }, { input: 33.33 }, { input: 33.34 }],
			}),
		).toEqual([34, 33, 33]);
	});

	it("shares: 1+2+3 over 30000 → 5000 / 10000 / 15000", () => {
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 30000,
				rows: [{ input: 1 }, { input: 2 }, { input: 3 }],
			}),
		).toEqual([5000, 10000, 15000]);
	});

	it("shares: integer-rounding remainder lands on payer", () => {
		// 1+1+1 over 10000 → 3333 each → 9999, payer gets 3333 + 1 = 3334.
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 10000,
				rows: [{ input: 1 }, { input: 1 }, { input: 1 }],
			}),
		).toEqual([3334, 3333, 3333]);
	});

	it("returns null when exact-method shares don't sum to total", () => {
		expect(
			computeShareCentavos({
				method: "exact",
				totalCentavos: 10000,
				rows: [{ input: 4000 }, { input: 3000 }, { input: 2000 }],
			}),
		).toBeNull();
	});

	it("returns null when percentage-method shares don't sum to 100", () => {
		expect(
			computeShareCentavos({
				method: "percentage",
				totalCentavos: 10000,
				rows: [{ input: 50 }, { input: 30 }, { input: 10 }],
			}),
		).toBeNull();
	});

	it("returns null when shares-method has any non-positive integer", () => {
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 10000,
				rows: [{ input: 1 }, { input: 0 }, { input: 1 }],
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

	it("returns null when a shares input is non-integer", () => {
		expect(
			computeShareCentavos({
				method: "shares",
				totalCentavos: 1000,
				rows: [{ input: 1.5 }, { input: 1 }],
			}),
		).toBeNull();
	});
});
