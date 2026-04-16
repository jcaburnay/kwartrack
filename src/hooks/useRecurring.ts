import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useRecurring() {
	const [definitions, isLoading] = useTable(tables.my_recurring_definitions);
	return { definitions, isLoading };
}
