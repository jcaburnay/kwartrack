import { useMemo } from "react";
import { mtdNetWorthDelta } from "../utils/netWorthAggregation";
import { useAccounts } from "./useAccounts";
import { useTransactions } from "./useTransactions";

type Result = {
	deltaCentavos: number;
	percentOfCurrent: number;
	isLoading: boolean;
	error: string | null;
};

/**
 * Month-to-date net worth delta. Composes existing fetchers; pure math in
 * `mtdNetWorthDelta`.
 */
export function useMtdDelta(today: Date, timezone: string): Result {
	const { accounts, isLoading: aLoading, error: aError } = useAccounts();
	const { transactions, isLoading: tLoading, error: tError } = useTransactions();

	const computed = useMemo(() => {
		if (aLoading || tLoading) return { deltaCentavos: 0, percentOfCurrent: 0 };
		return mtdNetWorthDelta(accounts, transactions, today, timezone);
	}, [accounts, transactions, today, timezone, aLoading, tLoading]);

	return {
		...computed,
		isLoading: aLoading || tLoading,
		error: aError ?? tError ?? null,
	};
}
