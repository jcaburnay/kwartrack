import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../utils/transactionFilters";

/**
 * Transaction with the source recurring's `service` joined in. Used by
 * TransactionsTable to render the back-link tooltip on the auto-gen-tx
 * repeat icon. The join is nullable — most rows have no recurring source.
 */
export type TransactionWithRecurring = Transaction & {
	recurring: { service: string } | null;
};

type State = {
	transactions: TransactionWithRecurring[];
	isLoading: boolean;
	error: string | null;
};

/**
 * Fetch top-level transactions (parents + standalone). Paired 'transfer-fees'
 * children are filtered out; they're surfaced via the parent row's `fee`
 * column in the UI and folded in by budget/summary math separately.
 */
export function useTransactions() {
	const [state, setState] = useState<State>({
		transactions: [],
		isLoading: true,
		error: null,
	});

	const refetch = useCallback(async () => {
		const { data, error } = await supabase
			.from("transaction")
			.select("*, recurring:recurring!recurring_id(service)")
			.is("parent_transaction_id", null)
			.order("date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({
			transactions: (data ?? []) as TransactionWithRecurring[],
			isLoading: false,
			error: null,
		});
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	return { ...state, refetch };
}
