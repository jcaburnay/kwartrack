import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useTagActions() {
	const addCustom = useReducer(reducers.addCustomTag);
	const removeCustom = useReducer(reducers.deleteCustomTag);
	const toggleVisibility = useReducer(reducers.toggleTagVisibility);
	return { addCustom, removeCustom, toggleVisibility };
}
