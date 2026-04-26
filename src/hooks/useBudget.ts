import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import {
	computeActualsByTag,
	computeOthersCentavos,
	computeOverallActualCentavos,
} from "../utils/budgetMath";
import type { Transaction } from "../utils/transactionFilters";

export type BudgetConfig = Database["public"]["Tables"]["budget_config"]["Row"];
export type BudgetAllocation = Database["public"]["Tables"]["budget_allocation"]["Row"];

type State = {
	config: BudgetConfig | null;
	allocations: BudgetAllocation[];
	monthExpenses: Transaction[];
	isLoading: boolean;
	error: string | null;
};

function monthRangeISO(month: string): { startISO: string; endExclusiveISO: string } {
	const [yStr, mStr] = month.split("-");
	const y = Number(yStr);
	const m = Number(mStr);
	const start = `${month}-01`;
	const ny = m === 12 ? y + 1 : y;
	const nm = m === 12 ? 1 : m + 1;
	const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
	return { startISO: start, endExclusiveISO: end };
}

export function useBudget(month: string) {
	const [state, setState] = useState<State>({
		config: null,
		allocations: [],
		monthExpenses: [],
		isLoading: true,
		error: null,
	});

	const refetch = useCallback(async () => {
		setState((s) => ({ ...s, isLoading: true, error: null }));
		const { startISO, endExclusiveISO } = monthRangeISO(month);
		const [cfgRes, allocRes, txRes] = await Promise.all([
			supabase.from("budget_config").select("*").eq("month", month).maybeSingle(),
			supabase.from("budget_allocation").select("*").eq("month", month),
			supabase
				.from("transaction")
				.select("*")
				.eq("type", "expense")
				.gte("date", startISO)
				.lt("date", endExclusiveISO),
		]);
		const err = cfgRes.error?.message ?? allocRes.error?.message ?? txRes.error?.message ?? null;
		setState({
			config: cfgRes.data ?? null,
			allocations: allocRes.data ?? [],
			monthExpenses: txRes.data ?? [],
			isLoading: false,
			error: err,
		});
	}, [month]);

	useEffect(() => {
		refetch();
	}, [refetch]);

	const actualsByTag = useMemo(
		() => computeActualsByTag(state.monthExpenses, month),
		[state.monthExpenses, month],
	);
	const allocatedTagIds = useMemo(
		() => new Set(state.allocations.map((a) => a.tag_id)),
		[state.allocations],
	);
	const othersCentavos = useMemo(
		() => computeOthersCentavos(actualsByTag, allocatedTagIds),
		[actualsByTag, allocatedTagIds],
	);
	const overallActualCentavos = useMemo(
		() => computeOverallActualCentavos(actualsByTag),
		[actualsByTag],
	);

	const setOverall = useCallback(
		async (centavos: number): Promise<string | null> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return "Not signed in";
			const { error } = await supabase
				.from("budget_config")
				.upsert(
					{ user_id: userData.user.id, month, overall_centavos: centavos },
					{ onConflict: "user_id,month" },
				);
			if (error) return error.message;
			await refetch();
			return null;
		},
		[month, refetch],
	);

	const upsertAllocation = useCallback(
		async (tagId: string, centavos: number): Promise<string | null> => {
			const { data: userData } = await supabase.auth.getUser();
			if (!userData.user) return "Not signed in";
			const { error } = await supabase
				.from("budget_allocation")
				.upsert(
					{ user_id: userData.user.id, month, tag_id: tagId, amount_centavos: centavos },
					{ onConflict: "user_id,month,tag_id" },
				);
			if (error) return error.message;
			await refetch();
			return null;
		},
		[month, refetch],
	);

	const deleteAllocation = useCallback(
		async (tagId: string): Promise<string | null> => {
			const { error } = await supabase
				.from("budget_allocation")
				.delete()
				.eq("month", month)
				.eq("tag_id", tagId);
			if (error) return error.message;
			await refetch();
			return null;
		},
		[month, refetch],
	);

	const copyFromPrevious = useCallback(async (): Promise<string | null> => {
		const { data: userData } = await supabase.auth.getUser();
		if (!userData.user) return "Not signed in";
		const { data: prevCfg } = await supabase
			.from("budget_config")
			.select("*")
			.lt("month", month)
			.order("month", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (!prevCfg) return "No previous month to copy from.";
		const setErr = await setOverall(prevCfg.overall_centavos);
		if (setErr) return setErr;
		const { data: prevAllocs } = await supabase
			.from("budget_allocation")
			.select("tag_id, amount_centavos")
			.eq("month", prevCfg.month);
		if (prevAllocs && prevAllocs.length > 0) {
			const rows = prevAllocs.map((a) => ({
				user_id: userData.user.id,
				month,
				tag_id: a.tag_id,
				amount_centavos: a.amount_centavos,
			}));
			const { error } = await supabase
				.from("budget_allocation")
				.upsert(rows, { onConflict: "user_id,month,tag_id" });
			if (error) return error.message;
		}
		await refetch();
		return null;
	}, [month, refetch, setOverall]);

	return {
		...state,
		actualsByTag,
		othersCentavos,
		overallActualCentavos,
		refetch,
		setOverall,
		upsertAllocation,
		deleteAllocation,
		copyFromPrevious,
	};
}
