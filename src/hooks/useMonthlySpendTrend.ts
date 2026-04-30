import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { monthBounds } from "../utils/dateRange";
import {
	bucketSpendByMonth,
	type SpendInputRow,
	type SpendTrendPoint,
} from "../utils/overviewAggregation";
import { useTransactionVersion } from "./useTransactionVersion";

type State = {
	trend: SpendTrendPoint[];
	isLoading: boolean;
	error: string | null;
};

/**
 * 12-month rolling expense aggregate, split-share aware (mirrors the rule in
 * `useBudget` — split-linked rows contribute only `user_share_centavos`).
 * Includes paired `transfer-fees` children — they are real spend.
 *
 * Caller passes today + timezone explicitly (vs reading global state) so that
 * the hook is deterministic in tests.
 */
export function useMonthlySpendTrend(today: Date, timezone: string) {
	const [state, setState] = useState<State>({ trend: [], isLoading: true, error: null });

	const refetch = useCallback(async () => {
		setState((s) => ({ ...s, isLoading: true, error: null }));

		// 12-month window: 11 months back + this month = 12 buckets.
		const since = new Date(today);
		since.setMonth(since.getMonth() - 11);
		const { startISO } = monthBounds(timezone, since);

		const { data, error } = await supabase
			.from("transaction")
			.select("date, amount_centavos, split:split_event!split_id(user_share_centavos)")
			.eq("type", "expense")
			.gte("date", startISO);

		if (error) {
			setState({ trend: [], isLoading: false, error: error.message });
			return;
		}

		const rows: SpendInputRow[] = (data ?? []).map((t) => ({
			date: t.date,
			effectiveCentavos:
				(t.split as unknown as { user_share_centavos: number } | null)?.user_share_centavos ??
				t.amount_centavos,
		}));

		setState({
			trend: bucketSpendByMonth(rows, today, timezone),
			isLoading: false,
			error: null,
		});
	}, [today, timezone]);

	const txVersion = useTransactionVersion();
	// biome-ignore lint/correctness/useExhaustiveDependencies: txVersion is a tripwire that re-runs the fetch when transactions are mutated elsewhere.
	useEffect(() => {
		refetch();
	}, [refetch, txVersion]);

	return { ...state, refetch };
}
