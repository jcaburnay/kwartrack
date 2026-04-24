import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Transaction } from "../utils/transactionFilters";

type State = {
	transactions: Transaction[];
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
			.select("*")
			.is("parent_transaction_id", null)
			.order("date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({ transactions: data ?? [], isLoading: false, error: null });
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	return { ...state, refetch };
}
