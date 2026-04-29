import { describe, expect, it } from "vitest";
import { type SortableRow, sortByOvershootRisk } from "../utils/budgetSorting";

const TZ = "Asia/Manila";
const midDay = new Date("2026-04-15T01:00:00Z"); // day 15 of 30

describe("sortByOvershootRisk", () => {
	it("orders highest projected/allocated first", () => {
		const rows: SortableRow[] = [
			{ tagId: "a", tagName: "alpha", allocated: 10_000_00, actual: 4_000_00 }, // proj 8000 → 0.8
			{ tagId: "b", tagName: "beta", allocated: 10_000_00, actual: 6_000_00 }, // proj 12000 → 1.2
			{ tagId: "c", tagName: "charlie", allocated: 10_000_00, actual: 11_000_00 }, // already over → 2.2
		];
		const sorted = sortByOvershootRisk(rows, midDay, TZ, "2026-04");
		expect(sorted.map((r) => r.tagId)).toEqual(["c", "b", "a"]);
	});

	it("breaks ties by tag name ascending", () => {
		const rows: SortableRow[] = [
			{ tagId: "a", tagName: "zoo", allocated: 10_000_00, actual: 5_000_00 },
			{ tagId: "b", tagName: "ant", allocated: 10_000_00, actual: 5_000_00 },
		];
		const sorted = sortByOvershootRisk(rows, midDay, TZ, "2026-04");
		expect(sorted.map((r) => r.tagId)).toEqual(["b", "a"]);
	});

	it("sorts allocated=0 rows to the end", () => {
		const rows: SortableRow[] = [
			{ tagId: "a", tagName: "alpha", allocated: 0, actual: 0 },
			{ tagId: "b", tagName: "beta", allocated: 10_000_00, actual: 5_000_00 },
		];
		const sorted = sortByOvershootRisk(rows, midDay, TZ, "2026-04");
		expect(sorted.map((r) => r.tagId)).toEqual(["b", "a"]);
	});

	it("uses raw actual ratio on early-month days (no pacing)", () => {
		const earlyDay = new Date("2026-04-02T01:00:00Z");
		const rows: SortableRow[] = [
			{ tagId: "a", tagName: "alpha", allocated: 10_000_00, actual: 5_000_00 }, // 0.5
			{ tagId: "b", tagName: "beta", allocated: 10_000_00, actual: 9_000_00 }, // 0.9
		];
		const sorted = sortByOvershootRisk(rows, earlyDay, TZ, "2026-04");
		expect(sorted.map((r) => r.tagId)).toEqual(["b", "a"]);
	});
});
