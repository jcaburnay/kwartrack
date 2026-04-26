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

import type { DebtRow } from "./debtFilters";
import type { Recurring } from "./recurringFilters";

export type UpcomingItem =
	| {
			kind: "recurring";
			id: string;
			service: string;
			amountCentavos: number;
			daysAway: number; // 0 means due now or overdue
	  }
	| {
			kind: "loaned-debt";
			id: string;
			personName: string;
			remainingCentavos: number;
			daysOld: number;
			debtDateISO: string;
	  }
	| {
			kind: "budget-warning";
			tagId: string;
			tagName: string;
			pct: number; // 0.85 = 85%
			daysLeftInMonth: number;
	  };

/**
 * Compute YYYY-MM-DD in a specific TZ from an instant.
 */
function ymdInTimezone(date: Date, timezone: string): string {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const parts = fmt.formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}`;
}

function daysBetween(fromISO: string, toISO: string): number {
	const a = Date.parse(`${fromISO}T00:00:00Z`);
	const b = Date.parse(`${toISO}T00:00:00Z`);
	return Math.round((b - a) / 86_400_000);
}

/**
 * Mixed feed for the Upcoming card:
 *   1. Recurrings firing in next 7 days (paused / completed excluded)
 *   2. Loaned debts older than 14 days, unsettled
 *   3. Budget tags ≥80% actual with at least 1 day left in the month
 *
 * Strict global urgency: recurrings (soonest first), then debts (oldest first),
 * then budget warnings (highest pct first). No per-type quotas — if 5
 * recurrings are due, all 5 slots are recurrings.
 */
export function selectUpcoming(
	recurrings: readonly Recurring[],
	debts: readonly DebtRow[],
	actualsByTag: ReadonlyMap<string, number>,
	allocations: readonly AllocationLite[],
	tags: readonly TagLite[],
	today: Date,
	timezone: string,
	max: number,
): UpcomingItem[] {
	const todayISO = ymdInTimezone(today, timezone);

	// 1. Recurrings within 7 days, sorted soonest first (overdue clamped to 0).
	const recurringItems: UpcomingItem[] = [];
	for (const r of recurrings) {
		if (r.is_paused || r.is_completed) continue;
		const fireISO = ymdInTimezone(new Date(r.next_occurrence_at), timezone);
		const daysAwayRaw = daysBetween(todayISO, fireISO);
		if (daysAwayRaw > 7) continue;
		const daysAway = Math.max(0, daysAwayRaw);
		recurringItems.push({
			kind: "recurring",
			id: r.id,
			service: r.service,
			amountCentavos: r.amount_centavos,
			daysAway,
		});
	}
	recurringItems.sort((a, b) => {
		if (a.kind !== "recurring" || b.kind !== "recurring") return 0;
		return a.daysAway - b.daysAway;
	});

	// 2. Loaned debts ≥14 days old, unsettled, oldest first.
	const debtItems: UpcomingItem[] = [];
	for (const d of debts) {
		if (d.direction !== "loaned") continue;
		if (d.settledCentavos >= d.amountCentavos) continue;
		const daysOld = daysBetween(d.date, todayISO);
		if (daysOld < 14) continue;
		debtItems.push({
			kind: "loaned-debt",
			id: d.id,
			personName: d.personName,
			remainingCentavos: d.amountCentavos - d.settledCentavos,
			daysOld,
			debtDateISO: d.date,
		});
	}
	debtItems.sort((a, b) => {
		if (a.kind !== "loaned-debt" || b.kind !== "loaned-debt") return 0;
		return b.daysOld - a.daysOld;
	});

	// 3. Budget tags ≥80% with at least 1 day left in the month.
	const bounds = monthBounds(timezone, today);
	const lastDayISO = (() => {
		// endExclusiveISO is YYYY-MM-01 of next month; subtract one day → last day.
		const next = new Date(`${bounds.endExclusiveISO}T00:00:00Z`);
		next.setUTCDate(next.getUTCDate() - 1);
		return next.toISOString().slice(0, 10);
	})();
	const daysLeft = daysBetween(todayISO, lastDayISO);
	const tagById = new Map(tags.map((t) => [t.id, t]));
	const warningItems: UpcomingItem[] = [];
	if (daysLeft >= 1) {
		for (const alloc of allocations) {
			const actual = actualsByTag.get(alloc.tag_id) ?? 0;
			if (alloc.amount_centavos === 0) continue;
			const pct = actual / alloc.amount_centavos;
			if (pct < 0.8) continue;
			const tag = tagById.get(alloc.tag_id);
			if (!tag) continue;
			warningItems.push({
				kind: "budget-warning",
				tagId: alloc.tag_id,
				tagName: tag.name,
				pct,
				daysLeftInMonth: daysLeft,
			});
		}
		warningItems.sort((a, b) => {
			if (a.kind !== "budget-warning" || b.kind !== "budget-warning") return 0;
			return b.pct - a.pct;
		});
	}

	return [...recurringItems, ...debtItems, ...warningItems].slice(0, max);
}
