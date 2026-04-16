import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useAccounts(options?: Parameters<typeof useTable>[1]) {
	const [accounts, isLoading] = useTable(tables.my_accounts, options);
	return { accounts, isLoading };
}
