import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import { computeOthersCentavos, computeOverallActualCentavos } from "../utils/budgetMath";
import { useBudgetActualsByMonth } from "./useBudgetActuals";
import { useVersion } from "./useTransactionVersion";

const TX_TABLES = ["transaction"] as const;

export type BudgetConfig = Database["public"]["Tables"]["budget_config"]["Row"];
export type BudgetAllocation = Database["public"]["Tables"]["budget_allocation"]["Row"];

type State = {
	config: BudgetConfig | null;
	allocations: BudgetAllocation[];
	isLoading: boolean;
	error: string | null;
};

export function useBudget(month: string) {
	const [state, setState] = useState<State>({
		config: null,
		allocations: [],
		isLoading: true,
		error: null,
	});

	const {
		actualsByTag,
		isLoading: actualsLoading,
		error: actualsError,
	} = useBudgetActualsByMonth(month);

	const refetch = useCallback(async () => {
		setState((s) => ({ ...s, isLoading: true, error: null }));
		const [cfgRes, allocRes] = await Promise.all([
			supabase.from("budget_config").select("*").eq("month", month).maybeSingle(),
			supabase.from("budget_allocation").select("*").eq("month", month),
		]);
		const err = cfgRes.error?.message ?? allocRes.error?.message ?? null;
		setState({
			config: cfgRes.data ?? null,
			allocations: allocRes.data ?? [],
			isLoading: false,
			error: err,
		});
	}, [month]);

	const txVersion = useVersion(TX_TABLES);
	// biome-ignore lint/correctness/useExhaustiveDependencies: txVersion is a tripwire that re-runs the fetch when transactions are mutated elsewhere.
	useEffect(() => {
		refetch();
	}, [refetch, txVersion]);

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
		isLoading: state.isLoading || actualsLoading,
		error: state.error ?? actualsError,
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
