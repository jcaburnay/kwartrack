import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
	type AllocationRow,
	type BudgetHistoryMonth,
	listMonths,
	mergeBudgetHistory,
} from "../utils/budgetHistory";
import type { ActualRow } from "../utils/budgetMath";
import { useTransactions } from "./useTransactions";

type Result = {
	history: BudgetHistoryMonth[];
	isLoading: boolean;
	error: string | null;
};

/**
 * Fetches budget_allocation rows for the last `monthCount` months and composes
 * them with already-loaded transactions to yield per-month {allocatedByTag,
 * actualsByTag} for the Tag history view. Approximates split-linked actuals
 * with `amount_centavos` (vs `useBudget` which subscribes to split_event); the
 * approximation is acceptable for visualization-only history charts.
 */
export function useBudgetHistory(currentMonth: string, monthCount: number): Result {
	const { transactions, isLoading: txLoading, error: txError } = useTransactions();
	const [allocs, setAllocs] = useState<AllocationRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const months = useMemo(() => listMonths(currentMonth, monthCount), [currentMonth, monthCount]);
	const earliest = months[0] ?? currentMonth;

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
		const expenseRows: ActualRow[] = transactions
			.filter((t) => t.type === "expense")
			.map((t) => ({
				tagId: t.tag_id,
				effectiveCentavos: t.amount_centavos,
				date: t.date,
			}));
		return mergeBudgetHistory(months, allocs, expenseRows);
	}, [months, allocs, transactions]);

	return {
		history,
		isLoading: isLoading || txLoading,
		error: error ?? txError,
	};
}
