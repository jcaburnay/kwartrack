import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
	type AllocationRow,
	type BudgetHistoryMonth,
	listMonths,
	mergeBudgetHistory,
} from "../utils/budgetHistory";
import type { ActualRow } from "../utils/budgetMath";
import { useBudgetActualsRange } from "./useBudgetActuals";

type Result = {
	history: BudgetHistoryMonth[];
	isLoading: boolean;
	error: string | null;
};

/**
 * Fetches budget_allocation rows for the last `monthCount` months and composes
 * them with the per-month actuals from the budget_actuals view to yield
 * {allocatedByTag, actualsByTag} per month for the Tag history view.
 */
export function useBudgetHistory(currentMonth: string, monthCount: number): Result {
	const [allocs, setAllocs] = useState<AllocationRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const months = useMemo(() => listMonths(currentMonth, monthCount), [currentMonth, monthCount]);
	const earliest = months[0] ?? currentMonth;

	const { actualsRange, isLoading: actualsLoading } = useBudgetActualsRange(earliest, currentMonth);

	const refetch = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		const { data, error: err } = await supabase
			.from("budget_allocation")
			.select("month, tag_id, amount_centavos")
			.gte("month", earliest)
			.lte("month", currentMonth);
		setAllocs(
			(data ?? []).map((r) => ({
				month: r.month,
				tagId: r.tag_id,
				amountCentavos: r.amount_centavos,
			})),
		);
		setError(err?.message ?? null);
		setIsLoading(false);
	}, [earliest, currentMonth]);

	useEffect(() => {
		refetch();
	}, [refetch]);

	const history = useMemo<BudgetHistoryMonth[]>(() => {
		// Reshape the view's per-month aggregated rows into the ActualRow format
		// mergeBudgetHistory expects. The day component is arbitrary — the merge
		// function only inspects the month prefix.
		const expenseRows: ActualRow[] = actualsRange.map((r) => ({
			tagId: r.tagId,
			effectiveCentavos: r.actualCentavos,
			date: `${r.month}-01`,
		}));
		return mergeBudgetHistory(months, allocs, expenseRows);
	}, [months, allocs, actualsRange]);

	return {
		history,
		isLoading: isLoading || actualsLoading,
		error,
	};
}
