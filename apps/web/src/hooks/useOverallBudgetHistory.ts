import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { listMonths } from "../utils/budgetHistory";
import {
	mergeOverallBudgetHistory,
	type OverallActualRow,
	type OverallBudgetHistoryMonth,
	type OverallCapRow,
} from "../utils/overallBudgetHistory";
import { useTransactionVersion } from "./useTransactionVersion";

type Result = {
	history: OverallBudgetHistoryMonth[];
	isLoading: boolean;
	error: string | null;
};

/**
 * Fetches per-month Overall cap (from `budget_config`) plus total actual
 * expense (split-share-aware, mirrors `useBudget` and `useMonthlySpendTrend`).
 * Used by the Overall option in the Budget History view so the line agrees
 * with the BudgetAnchor hero.
 */
export function useOverallBudgetHistory(currentMonth: string, monthCount: number): Result {
	const [caps, setCaps] = useState<OverallCapRow[]>([]);
	const [actuals, setActuals] = useState<OverallActualRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const months = useMemo(() => listMonths(currentMonth, monthCount), [currentMonth, monthCount]);
	const earliestMonth = months[0] ?? currentMonth;
	const latestMonth = currentMonth;

	const refetch = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		const earliestDate = `${earliestMonth}-01`;
		// transactions are dated YYYY-MM-DD; latest month + "-31" is a safe upper
		// bound (string compare against DATE works for any in-month day).
		const latestDate = `${latestMonth}-31`;

		const [{ data: capRows, error: capErr }, { data: txRows, error: txErr }] = await Promise.all([
			supabase
				.from("budget_config")
				.select("month, overall_centavos")
				.gte("month", earliestMonth)
				.lte("month", latestMonth),
			supabase
				.from("transaction")
				.select("date, amount_centavos, split:split_event!split_id(user_share_centavos)")
				.eq("type", "expense")
				.gte("date", earliestDate)
				.lte("date", latestDate),
		]);

		if (capErr) {
			setError(capErr.message);
			setIsLoading(false);
			return;
		}
		if (txErr) {
			setError(txErr.message);
			setIsLoading(false);
			return;
		}

		setCaps((capRows ?? []).map((r) => ({ month: r.month, overallCentavos: r.overall_centavos })));
		setActuals(
			(txRows ?? []).map((t) => ({
				date: t.date,
				effectiveCentavos:
					(t.split as unknown as { user_share_centavos: number } | null)?.user_share_centavos ??
					t.amount_centavos,
			})),
		);
		setIsLoading(false);
	}, [earliestMonth, latestMonth]);

	const txVersion = useTransactionVersion();
	// biome-ignore lint/correctness/useExhaustiveDependencies: txVersion is a tripwire that re-runs the fetch when transactions are mutated elsewhere.
	useEffect(() => {
		refetch();
	}, [refetch, txVersion]);

	const history = useMemo(
		() => mergeOverallBudgetHistory(months, caps, actuals),
		[months, caps, actuals],
	);

	return { history, isLoading, error };
}
