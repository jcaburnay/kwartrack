import { useMemo } from "react";
import { supabase } from "../lib/supabase";
import { createKeyedSharedStore } from "./sharedStore";

export type ActualByTag = Map<string, number>;

type ActualsRange = ReadonlyArray<{ month: string; tagId: string; actualCentavos: number }>;

/**
 * Reads from the `budget_actuals` Postgres view (split-aware aggregation of
 * expense rows). Replaces the per-hook client-side bucketing that useBudget,
 * useBudgetOverage, and useBudgetHistory each did over their own copy of the
 * transaction list.
 *
 * Single-month variant returns a Map<tagId, centavos>. Range variant returns
 * a flat list of {month, tagId, actualCentavos} rows for cross-month views.
 *
 * Cache is keyed by month (or month-range), so the dashboard's two consumers
 * for the current month share one round-trip.
 */
const monthlyStore = createKeyedSharedStore<string, ActualByTag>(
	async (month: string) => {
		const { data, error } = await supabase
			.from("budget_actuals")
			.select("tag_id, actual_centavos")
			.eq("month", month);
		if (error) throw new Error(error.message);
		const map: ActualByTag = new Map();
		for (const row of data ?? []) {
			if (!row.tag_id) continue;
			map.set(row.tag_id, Number(row.actual_centavos ?? 0));
		}
		return map;
	},
	new Map(),
	["transaction"],
);

const rangeStore = createKeyedSharedStore<string, ActualsRange>(
	async (rangeKey: string) => {
		const [startMonth, endMonth] = rangeKey.split("..", 2);
		const { data, error } = await supabase
			.from("budget_actuals")
			.select("month, tag_id, actual_centavos")
			.gte("month", startMonth)
			.lte("month", endMonth);
		if (error) throw new Error(error.message);
		const rows: { month: string; tagId: string; actualCentavos: number }[] = [];
		for (const row of data ?? []) {
			if (!row.month || !row.tag_id) continue;
			rows.push({
				month: row.month,
				tagId: row.tag_id,
				actualCentavos: Number(row.actual_centavos ?? 0),
			});
		}
		return rows;
	},
	[],
	["transaction"],
);

export function useBudgetActualsByMonth(month: string) {
	const { data, isLoading, error, refetch } = monthlyStore.useStore(month);
	return { actualsByTag: data, isLoading, error, refetch };
}

export function useBudgetActualsRange(startMonth: string, endMonth: string) {
	const key = useMemo(() => `${startMonth}..${endMonth}`, [startMonth, endMonth]);
	const { data, isLoading, error, refetch } = rangeStore.useStore(key);
	return { actualsRange: data, isLoading, error, refetch };
}
