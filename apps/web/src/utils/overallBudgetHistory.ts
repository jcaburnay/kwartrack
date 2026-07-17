import { shortMonthYearLabel } from "./budgetHistory";

export type OverallCapRow = {
	month: string;
	overallCentavos: number;
};

export type OverallActualRow = {
	date: string; // YYYY-MM-DD
	effectiveCentavos: number; // pre-mapped split-share or full amount (caller handles)
};

export type OverallBudgetHistoryMonth = {
	monthISO: string;
	monthLabel: string;
	capCentavos: number;
	actualCentavos: number;
};

/**
 * Per-month aggregate of overall budget cap (from `budget_config`) and total
 * actual expenses (split-share-aware; caller maps split rows to user_share
 * before passing). Months without a budget_config row default to capCentavos = 0
 * so the chart still emits a bar position but no Budget series.
 */
export function mergeOverallBudgetHistory(
	months: readonly string[],
	caps: readonly OverallCapRow[],
	expenseRows: readonly OverallActualRow[],
): OverallBudgetHistoryMonth[] {
	const capByMonth = new Map<string, number>();
	for (const c of caps) capByMonth.set(c.month, c.overallCentavos);

	const actualByMonth = new Map<string, number>();
	for (const r of expenseRows) {
		const m = r.date.slice(0, 7);
		actualByMonth.set(m, (actualByMonth.get(m) ?? 0) + r.effectiveCentavos);
	}

	return months.map((m) => ({
		monthISO: m,
		monthLabel: shortMonthYearLabel(m),
		capCentavos: capByMonth.get(m) ?? 0,
		actualCentavos: actualByMonth.get(m) ?? 0,
	}));
}
