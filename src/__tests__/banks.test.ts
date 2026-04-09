import { describe, expect, it } from "vitest";
import { BANKS, filterBanks, findBank } from "../data/banks";

describe("filterBanks", () => {
	it("returns empty array for query shorter than 2 chars", () => {
		expect(filterBanks("b")).toEqual([]);
		expect(filterBanks("")).toEqual([]);
	});

	it("matches by bank name (case-insensitive)", () => {
		const results = filterBanks("bdo");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].id).toBe("bdo");
	});

	it("matches by alias", () => {
		const results = filterBanks("banco de oro");
		expect(results.some((b) => b.id === "bdo")).toBe(true);
	});

	it("matches partial name", () => {
		const results = filterBanks("gcash");
		expect(results.some((b) => b.id === "gcash")).toBe(true);
	});

	it("returns at most 5 results", () => {
		// "bank" matches many entries
		const results = filterBanks("bank");
		expect(results.length).toBeLessThanOrEqual(5);
	});

	it("returns empty for no match", () => {
		expect(filterBanks("zxzxzxzx")).toEqual([]);
	});
});

describe("findBank", () => {
	it("returns the bank entry for a known id", () => {
		const bank = findBank("bpi");
		expect(bank).toBeDefined();
		expect(bank?.name).toBe("Bank of the Philippine Islands");
	});

	it("returns undefined for unknown id", () => {
		expect(findBank("unknown-bank-xyz")).toBeUndefined();
	});
});

describe("BANKS", () => {
	it("has no duplicate ids", () => {
		const ids = BANKS.map((b) => b.id);
		const unique = new Set(ids);
		expect(unique.size).toBe(ids.length);
	});

	it("every entry has abbr of 1-4 characters", () => {
		for (const bank of BANKS) {
			expect(bank.abbr.length).toBeGreaterThanOrEqual(1);
			expect(bank.abbr.length).toBeLessThanOrEqual(4);
		}
	});
});
