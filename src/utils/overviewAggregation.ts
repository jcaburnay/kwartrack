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

export type TopTagRow = {
	tagId: string;
	tagName: string;
	actualCentavos: number;
	budgetCentavos: number;
	pct: number;
};

type AllocationLite = { tag_id: string; amount_centavos: number };
type TagLite = { id: string; name: string };

/**
 * Pick the top N allocated tags by actual spend for the current month.
 * Excludes zero-actual rows and the synthetic "Others" bucket (unallocated
 * tags). Ties broken by tag name ascending for deterministic ordering.
 */
export function selectTopTagsByActual(
	actualsByTag: ReadonlyMap<string, number>,
	allocations: readonly AllocationLite[],
	tags: readonly TagLite[],
	n: number,
): TopTagRow[] {
	const tagById = new Map(tags.map((t) => [t.id, t]));
	const rows: TopTagRow[] = [];
	for (const alloc of allocations) {
		const actual = actualsByTag.get(alloc.tag_id) ?? 0;
		if (actual <= 0) continue;
		const tag = tagById.get(alloc.tag_id);
		if (!tag) continue;
		rows.push({
			tagId: alloc.tag_id,
			tagName: tag.name,
			actualCentavos: actual,
			budgetCentavos: alloc.amount_centavos,
			pct: alloc.amount_centavos === 0 ? 0 : actual / alloc.amount_centavos,
		});
	}
	rows.sort((a, b) => {
		if (b.actualCentavos !== a.actualCentavos) return b.actualCentavos - a.actualCentavos;
		return a.tagName.localeCompare(b.tagName);
	});
	return rows.slice(0, n);
}
