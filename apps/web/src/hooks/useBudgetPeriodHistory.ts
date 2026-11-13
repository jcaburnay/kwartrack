import { supabase } from "../lib/supabase";
import { periodLabel } from "../utils/budgetPeriod";
import { createKeyedSharedStore } from "./sharedStore";
import type { BudgetPeriod } from "./useBudgetPeriods";

type HistoryRow = {
	monthISO: string;
	monthLabel: string;
	allocatedByTag: Map<string, number>;
	actualsByTag: Map<string, number>;
	capCentavos: number;
	actualCentavos: number;
};
const store = createKeyedSharedStore<string, HistoryRow[]>(
	async (key) => {
		if (!key) return [];
		const periods = JSON.parse(key) as BudgetPeriod[];
		return await Promise.all(
			periods.map(async (p) => {
				const [alloc, actual] = await Promise.all([
					supabase
						.from("budget_period_allocation")
						.select("tag_id,amount_centavos")
						.eq("period_id", p.id),
					supabase.rpc("budget_range_actuals", { p_start: p.start_date, p_end: p.end_date }),
				]);
				if (alloc.error || actual.error)
					throw new Error(alloc.error?.message ?? actual.error?.message);
				const actualsByTag = new Map(
					(actual.data ?? []).map((a) => [a.tag_id ?? "", Number(a.actual_centavos)]),
				);
				return {
					monthISO: p.id,
					monthLabel: periodLabel(p),
					capCentavos: p.overall_centavos,
					actualCentavos: [...actualsByTag.values()].reduce((a, b) => a + b, 0),
					actualsByTag,
					allocatedByTag: new Map((alloc.data ?? []).map((a) => [a.tag_id, a.amount_centavos])),
				};
			}),
		);
	},
	[],
	["budget_period", "budget_period_allocation", "transaction", "split_event"],
);
export function useBudgetPeriodHistory(periods: readonly BudgetPeriod[]) {
	const state = store.useStore(periods.length ? JSON.stringify(periods) : "");
	return { ...state, history: state.data };
}
