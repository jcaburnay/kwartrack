import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useTransactions() {
	const [transactions, isLoading] = useTable(tables.my_transactions);
	return { transactions, isLoading };
}
