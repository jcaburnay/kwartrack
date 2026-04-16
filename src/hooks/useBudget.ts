import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useBudget() {
	const [config, isConfigLoading] = useTable(tables.my_budget_config);
	const [allocations, isAllocationsLoading] = useTable(tables.my_budget_allocations);
	return { config, allocations, isLoading: isConfigLoading || isAllocationsLoading };
}
