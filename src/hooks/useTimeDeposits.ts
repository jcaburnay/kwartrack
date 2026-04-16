import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useTimeDeposits() {
	const [metadata, isLoading] = useTable(tables.my_time_deposit_metadata);
	return { metadata, isLoading };
}
