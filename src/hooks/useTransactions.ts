import { supabase } from "../lib/supabase";
import type { Transaction } from "../utils/transactionFilters";
import { createSharedStore, registerSharedStore } from "./sharedStore";

/**
 * Transaction with the source recurring's `service` joined in. Used by
 * TransactionsTable to render the back-link tooltip on the auto-gen-tx
 * repeat icon. The join is nullable — most rows have no recurring source.
 */
export type TransactionWithRecurring = Transaction & {
	recurring: { service: string } | null;
};

/**
 * Fetch top-level transactions (parents + standalone). Paired 'transfer-fees'
 * children are filtered out; they're surfaced via the parent row's `fee`
 * column in the UI and folded in by budget/summary math separately.
 */
const store = createSharedStore<TransactionWithRecurring[]>(async () => {
	const { data, error } = await supabase
		.from("transaction")
		.select("*, recurring:recurring!recurring_id(service)")
		.is("parent_transaction_id", null)
		.order("date", { ascending: false })
		.order("created_at", { ascending: false });
	if (error) throw new Error(error.message);
	return (data ?? []) as TransactionWithRecurring[];
}, []);

registerSharedStore(store.reset);

export function useTransactions() {
	const { data, isLoading, error, refetch } = store.useStore();
	return { transactions: data, isLoading, error, refetch };
}
