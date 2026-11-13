import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import { computeOthersCentavos, computeOverallActualCentavos } from "../utils/budgetMath";
import { createKeyedSharedStore } from "./sharedStore";
import { useBudgetActualsByPeriod } from "./useBudgetActuals";
import type { BudgetPeriod } from "./useBudgetPeriods";
import { bumpVersion } from "./useTransactionVersion";

export type BudgetConfig = BudgetPeriod;
export type BudgetAllocation = Database["public"]["Tables"]["budget_period_allocation"]["Row"];
const allocationsStore = createKeyedSharedStore<string, BudgetAllocation[]>(
	async (id) => {
		if (!id) return [];
		const { data, error } = await supabase
			.from("budget_period_allocation")
			.select("*")
			.eq("period_id", id);
		if (error) throw new Error(error.message);
		return data ?? [];
	},
	[],
	["budget_period_allocation", "budget_period"],
);

export function useBudget(period: BudgetPeriod | null) {
	const state = allocationsStore.useStore(period?.id ?? "");
	const actuals = useBudgetActualsByPeriod(period);
	const allocations = period ? state.data : [];
	async function changed() {
		bumpVersion("budget_period_allocation");
		bumpVersion("budget_period");
		await state.refetch();
	}
	async function setOverall(centavos: number): Promise<string | null> {
		if (!period) return "Create a budget first.";
		const { error } = await supabase
			.from("budget_period")
			.update({ overall_centavos: centavos })
			.eq("id", period.id);
		if (error) return error.message;
		await changed();
		return null;
	}
	async function upsertAllocation(tagId: string, centavos: number): Promise<string | null> {
		if (!period) return "Create a budget first.";
		const { error } = await supabase
			.from("budget_period_allocation")
			.upsert(
				{ user_id: period.user_id, period_id: period.id, tag_id: tagId, amount_centavos: centavos },
				{ onConflict: "period_id,tag_id" },
			);
		if (error) return error.message;
		await changed();
		return null;
	}
	async function deleteAllocation(tagId: string): Promise<string | null> {
		if (!period) return "Create a budget first.";
		const { error } = await supabase
			.from("budget_period_allocation")
			.delete()
			.eq("period_id", period.id)
			.eq("tag_id", tagId);
		if (error) return error.message;
		await changed();
		return null;
	}
	async function copyFromPeriod(sourceId: string): Promise<string | null> {
		if (!period) return "Create a budget first.";
		const { error } = await supabase.rpc("copy_budget_period", {
			p_target: period.id,
			p_source: sourceId,
		});
		if (error) return error.message;
		await changed();
		return null;
	}
	return {
		config: period,
		allocations,
		actualsByTag: actuals.actualsByTag,
		othersCentavos: computeOthersCentavos(
			actuals.actualsByTag,
			new Set(allocations.map((a) => a.tag_id)),
		),
		overallActualCentavos: computeOverallActualCentavos(actuals.actualsByTag),
		isLoading: state.isLoading || actuals.isLoading,
		error: state.error ?? actuals.error,
		setOverall,
		upsertAllocation,
		deleteAllocation,
		copyFromPeriod,
	};
}
