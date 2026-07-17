import { describe, expect, it } from "vitest";
import { mergeOverallBudgetHistory } from "../utils/overallBudgetHistory";

describe("mergeOverallBudgetHistory", () => {
	const months = ["2026-03", "2026-04", "2026-05"];

	it("emits one row per month with cap and actual aligned", () => {
		const result = mergeOverallBudgetHistory(
			months,
			[
				{ month: "2026-03", overallCentavos: 15_000_00 },
				{ month: "2026-04", overallCentavos: 20_000_00 },
				{ month: "2026-05", overallCentavos: 20_000_00 },
			],
			[
				{ date: "2026-03-04", effectiveCentavos: 1_000_00 },
				{ date: "2026-03-22", effectiveCentavos: 2_500_00 },
				{ date: "2026-04-10", effectiveCentavos: 4_000_00 },
				{ date: "2026-05-01", effectiveCentavos: 500_00 },
			],
		);
		expect(result).toEqual([
			{
				monthISO: "2026-03",
				monthLabel: "Mar 2026",
				capCentavos: 15_000_00,
				actualCentavos: 3_500_00,
			},
			{
				monthISO: "2026-04",
				monthLabel: "Apr 2026",
				capCentavos: 20_000_00,
				actualCentavos: 4_000_00,
			},
			{
				monthISO: "2026-05",
				monthLabel: "May 2026",
				capCentavos: 20_000_00,
				actualCentavos: 500_00,
			},
		]);
	});

	it("defaults missing budget_config rows to capCentavos = 0", () => {
		const result = mergeOverallBudgetHistory(
			months,
			[{ month: "2026-04", overallCentavos: 20_000_00 }],
			[],
		);
		expect(result.map((r) => r.capCentavos)).toEqual([0, 20_000_00, 0]);
	});

	it("defaults missing actuals to 0", () => {
		const result = mergeOverallBudgetHistory(months, [], []);
		expect(result.map((r) => r.actualCentavos)).toEqual([0, 0, 0]);
	});

	it("ignores expense rows outside the requested month range", () => {
		const result = mergeOverallBudgetHistory(
			months,
			[],
			[
				{ date: "2026-02-15", effectiveCentavos: 9_999_00 }, // before
				{ date: "2026-04-01", effectiveCentavos: 1_000_00 }, // in
				{ date: "2026-06-30", effectiveCentavos: 9_999_00 }, // after
			],
		);
		expect(result.map((r) => r.actualCentavos)).toEqual([0, 1_000_00, 0]);
	});
});
