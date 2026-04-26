import { describe, expect, it } from "vitest";
import { DEFAULT_DEBT_FILTERS, type DebtRow, matchesDebtFilters } from "../utils/debtFilters";

const base: DebtRow = {
	id: "d-1",
	personId: "p-1",
	personName: "Alice",
	direction: "loaned",
	amountCentavos: 50000,
	settledCentavos: 0,
	tagId: "t-food",
	tagName: "foods",
	date: "2026-04-14",
	description: "lunch",
};

describe("matchesDebtFilters", () => {
	it("default filters match every row", () => {
		expect(matchesDebtFilters(base, DEFAULT_DEBT_FILTERS)).toBe(true);
	});
	it("filters by direction", () => {
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, direction: "owed" })).toBe(false);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, direction: "loaned" })).toBe(true);
	});
	it("settled = 'unsettled' excludes fully-settled debts", () => {
		const fullySettled = { ...base, settledCentavos: 50000 };
		expect(
			matchesDebtFilters(fullySettled, { ...DEFAULT_DEBT_FILTERS, settled: "unsettled" }),
		).toBe(false);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, settled: "unsettled" })).toBe(true);
	});
	it("settled = 'settled' includes only fully-settled", () => {
		const fullySettled = { ...base, settledCentavos: 50000 };
		expect(matchesDebtFilters(fullySettled, { ...DEFAULT_DEBT_FILTERS, settled: "settled" })).toBe(
			true,
		);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, settled: "settled" })).toBe(false);
	});
	it("filters by personId, tagId, dateFrom/To", () => {
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, personId: "p-2" })).toBe(false);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, tagId: "t-other" })).toBe(false);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, dateFrom: "2026-04-15" })).toBe(
			false,
		);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, dateTo: "2026-04-10" })).toBe(false);
		expect(
			matchesDebtFilters(base, {
				...DEFAULT_DEBT_FILTERS,
				dateFrom: "2026-04-01",
				dateTo: "2026-04-30",
			}),
		).toBe(true);
	});
	it("query filter matches person name OR description, case-insensitive", () => {
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, query: "ALICE" })).toBe(true);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, query: "lunch" })).toBe(true);
		expect(matchesDebtFilters(base, { ...DEFAULT_DEBT_FILTERS, query: "dinner" })).toBe(false);
	});
});
