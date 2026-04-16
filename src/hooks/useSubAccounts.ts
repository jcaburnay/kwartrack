import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useSubAccounts() {
	const [subAccounts, isLoading] = useTable(tables.my_sub_accounts);
	return { subAccounts, isLoading };
}
