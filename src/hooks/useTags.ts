import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";

export function useTags() {
	const [tagConfigs, isLoading] = useTable(tables.my_tag_configs);
	return { tagConfigs, isLoading };
}
