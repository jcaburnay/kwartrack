import { useMemo } from "react";
import { bucketCashFlowByMonth, type CashFlowPoint } from "../utils/netWorthAggregation";
import { useTransactions } from "./useTransactions";

type Result = {
	trend: CashFlowPoint[];
	isLoading: boolean;
	error: string | null;
};

/**
 * Per-month cash flow (income vs expense, with net) over the last `monthCount`
 * months in the user's TZ.
 */
export function useCashFlowTrend(today: Date, timezone: string, monthCount: number): Result {
	const { transactions, isLoading, error } = useTransactions();

	const trend = useMemo(() => {
		if (isLoading) return [];
		return bucketCashFlowByMonth(transactions, today, timezone, monthCount);
	}, [transactions, today, timezone, monthCount, isLoading]);

	return { trend, isLoading, error };
}
