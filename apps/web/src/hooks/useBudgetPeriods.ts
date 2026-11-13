import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { BudgetDateRange } from "../utils/budgetPeriod";
import { ymdISO } from "../utils/dateRange";
import { createSharedStore, registerSharedStore } from "./sharedStore";
import { bumpVersion } from "./useTransactionVersion";

export type BudgetPeriod = Database["public"]["Tables"]["budget_period"]["Row"];
const periodStore = createSharedStore<BudgetPeriod[]>(
	async () => {
		const { data, error } = await supabase
			.from("budget_period")
			.select("*")
			.order("start_date", { ascending: false });
		if (error) throw new Error(error.message);
		return data ?? [];
	},
	[],
	["budget_period"],
);
registerSharedStore(periodStore.reset);

export function useTodayISO(timezone: string) {
	const [today, setToday] = useState(() => ymdISO(new Date(), timezone));
	useEffect(() => {
		const update = () => setToday(ymdISO(new Date(), timezone));
		update();
		const interval = window.setInterval(update, 30000);
		window.addEventListener("focus", update);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener("focus", update);
		};
	}, [timezone]);
	return today;
}

export function useBudgetPeriods() {
	const state = periodStore.useStore();
	async function savePeriod(
		range: BudgetDateRange,
		overallCentavos: number,
		id?: string,
	): Promise<{ id: string | null; error: string | null }> {
		const { data: auth, error: authError } = await supabase.auth.getUser();
		if (authError || !auth.user) return { id: null, error: authError?.message ?? "Not signed in" };
		const values = { ...range, overall_centavos: overallCentavos };
		const result = id
			? await supabase.from("budget_period").update(values).eq("id", id).select("id").single()
			: await supabase
					.from("budget_period")
					.insert({ ...values, user_id: auth.user.id })
					.select("id")
					.single();
		if (result.error)
			return {
				id: null,
				error:
					result.error.code === "23P01"
						? "These dates overlap another budget. Choose a different date range."
						: result.error.message,
			};
		bumpVersion("budget_period");
		await periodStore.refetch();
		return { id: result.data.id, error: null };
	}
	return { ...state, periods: state.data, savePeriod };
}
