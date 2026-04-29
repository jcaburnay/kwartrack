import { useMemo } from "react";
import { bucketNetWorthByMonth, type NetWorthPoint } from "../utils/netWorthAggregation";
import { useAccounts } from "./useAccounts";
import { useTransactions } from "./useTransactions";

type Result = {
	trend: NetWorthPoint[];
	isLoading: boolean;
	error: string | null;
};

/**
 * Per-month net worth over the last `monthCount` months in the user's TZ.
 * Composes existing fetchers — no extra Supabase round-trips — and reuses the
 * pure aggregation in `netWorthAggregation`.
 */
export function useNetWorthTrend(today: Date, timezone: string, monthCount: number): Result {
	const { accounts, isLoading: aLoading, error: aError } = useAccounts();
	const { transactions, isLoading: tLoading, error: tError } = useTransactions();

	const trend = useMemo(() => {
		if (aLoading || tLoading) return [];
		return bucketNetWorthByMonth(accounts, transactions, today, timezone, monthCount);
	}, [accounts, transactions, today, timezone, monthCount, aLoading, tLoading]);

	return {
		trend,
		isLoading: aLoading || tLoading,
		error: aError ?? tError ?? null,
	};
}
