import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useDebts() {
	const [debts, isLoading] = useTable(tables.my_debts);
	return { debts, isLoading };
}
