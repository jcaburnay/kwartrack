import { describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_FILTERS, matchesSplitFilters, type SplitRow } from "../utils/splitFilters";

const base: SplitRow = {
	id: "s-1",
	description: "Mama Lou's",
	totalCentavos: 480000,
	userShareCentavos: 96000,
	paidFromAccountId: "a-1",
	tagId: "t-dates",
	tagName: "dates",
	method: "equal",
	date: "2026-04-14",
	participantCount: 4,
	settledCount: 0,
	participantNames: ["Alice", "Bob", "Carol"],
};

describe("matchesSplitFilters", () => {
	it("default matches everything", () => {
		expect(matchesSplitFilters(base, DEFAULT_SPLIT_FILTERS)).toBe(true);
	});
	it("filters by tagId, method, date range", () => {
		expect(matchesSplitFilters(base, { ...DEFAULT_SPLIT_FILTERS, tagId: "t-other" })).toBe(false);
		expect(matchesSplitFilters(base, { ...DEFAULT_SPLIT_FILTERS, method: "exact" })).toBe(false);
		expect(matchesSplitFilters(base, { ...DEFAULT_SPLIT_FILTERS, dateFrom: "2026-05-01" })).toBe(
			false,
		);
	});
	it("progress: 'not-settled' excludes any settled progress", () => {
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 0 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "not-settled" },
			),
		).toBe(true);
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 1 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "not-settled" },
			),
		).toBe(false);
	});
	it("progress: 'fully-settled' requires settledCount === participantCount", () => {
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 4 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "fully-settled" },
			),
		).toBe(true);
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 3 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "fully-settled" },
			),
		).toBe(false);
	});
	it("progress: 'partially-settled' is between", () => {
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 2 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "partially-settled" },
			),
		).toBe(true);
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 0 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "partially-settled" },
			),
		).toBe(false);
		expect(
			matchesSplitFilters(
				{ ...base, settledCount: 4 },
				{ ...DEFAULT_SPLIT_FILTERS, progress: "partially-settled" },
			),
		).toBe(false);
	});
	it("query matches description OR participant name", () => {
		expect(matchesSplitFilters(base, { ...DEFAULT_SPLIT_FILTERS, query: "mama" })).toBe(true);
		expect(matchesSplitFilters(base, { ...DEFAULT_SPLIT_FILTERS, query: "alice" })).toBe(true);
		expect(matchesSplitFilters(base, { ...DEFAULT_SPLIT_FILTERS, query: "spotify" })).toBe(false);
	});
});
