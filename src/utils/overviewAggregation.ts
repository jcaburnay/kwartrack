/**
 * Pure aggregation helpers for the Overview dashboard. No IO; deterministic;
 * fully unit-tested. The hooks layer (`useMonthlySpendTrend`,
 * `useDebtsAndSplits`, `useRecurrings`, `useBudget`) does the fetching and
 * passes already-shaped data into these functions.
 */
import { monthBounds } from "./dateRange";

export type SpendInputRow = {
	date: string; // YYYY-MM-DD (DATE column)
	effectiveCentavos: number; // pre-mapped split-share or full amount
};

export type SpendTrendPoint = {
	monthISO: string; // YYYY-MM
	monthLabel: string; // "April 2026"
	totalCentavos: number;
};

/**
 * Bucket a flat list of expense rows into exactly 12 calendar months in the
 * user's TZ, oldest → newest, anchored on today's month. Months without spend
 * are emitted with totalCentavos = 0 so the chart never goes blank.
 *
 * `effectiveCentavos` is the pre-mapped value: split-linked rows already
 * contribute only the user's share via `coalesce(split.user_share_centavos,
 * amount_centavos)` — same rule as Budget actuals (spec §689-694).
 */
export function bucketSpendByMonth(
	rows: readonly SpendInputRow[],
	today: Date,
	timezone: string,
): SpendTrendPoint[] {
	const months: SpendTrendPoint[] = [];
	for (let i = 11; i >= 0; i--) {
		const anchor = new Date(today);
		anchor.setMonth(anchor.getMonth() - i);
		const bounds = monthBounds(timezone, anchor);
		months.push({
			monthISO: bounds.startISO.slice(0, 7),
			monthLabel: bounds.monthLabel,
			totalCentavos: 0,
		});
	}
	const indexByISO = new Map(months.map((m, i) => [m.monthISO, i]));
	for (const row of rows) {
		const monthISO = row.date.slice(0, 7);
		const idx = indexByISO.get(monthISO);
		if (idx === undefined) continue;
		months[idx].totalCentavos += row.effectiveCentavos;
	}
	return months;
}
