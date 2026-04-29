import { describe, expect, it } from "vitest";
import type { ActualRow } from "../utils/budgetMath";
import {
	type AllocationRow,
	listMonths,
	mergeBudgetHistory,
	shortMonthYearLabel,
} from "../utils/budgetHistory";

describe("listMonths", () => {
	it("returns N months ending at currentMonth, oldest first", () => {
		expect(listMonths("2026-04", 3)).toEqual(["2026-02", "2026-03", "2026-04"]);
	});
	it("crosses year boundaries", () => {
		expect(listMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
	});
	it("returns just currentMonth when count is 1", () => {
		expect(listMonths("2026-04", 1)).toEqual(["2026-04"]);
	});
});

describe("shortMonthYearLabel", () => {
	it("renders 'Mon YYYY' for a YYYY-MM string", () => {
		expect(shortMonthYearLabel("2026-04")).toBe("Apr 2026");
		expect(shortMonthYearLabel("2026-12")).toBe("Dec 2026");
	});
});

describe("mergeBudgetHistory", () => {
	it("groups allocations and actuals by month", () => {
		const months = ["2026-03", "2026-04"];
		const allocs: AllocationRow[] = [
			{ month: "2026-03", tagId: "foods", amountCentavos: 10_000_00 },
			{ month: "2026-04", tagId: "foods", amountCentavos: 12_000_00 },
			{ month: "2026-04", tagId: "pets", amountCentavos: 5_000_00 },
		];
		const expenseRows: ActualRow[] = [
			{ tagId: "foods", effectiveCentavos: 8_000_00, date: "2026-03-15" },
			{ tagId: "foods", effectiveCentavos: 9_000_00, date: "2026-04-10" },
			{ tagId: "pets", effectiveCentavos: 2_000_00, date: "2026-04-20" },
		];
		const result = mergeBudgetHistory(months, allocs, expenseRows);
		expect(result).toHaveLength(2);
		expect(result[0]?.monthISO).toBe("2026-03");
		expect(result[0]?.allocatedByTag.get("foods")).toBe(10_000_00);
		expect(result[0]?.actualsByTag.get("foods")).toBe(8_000_00);
		expect(result[1]?.allocatedByTag.get("pets")).toBe(5_000_00);
		expect(result[1]?.actualsByTag.get("pets")).toBe(2_000_00);
	});

	it("yields empty maps for months with no data", () => {
		const result = mergeBudgetHistory(["2026-02"], [], []);
		expect(result[0]?.allocatedByTag.size).toBe(0);
		expect(result[0]?.actualsByTag.size).toBe(0);
		expect(result[0]?.monthLabel).toBe("Feb 2026");
	});
});
