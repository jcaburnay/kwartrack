import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useSplitActions() {
	const create = useReducer(reducers.createSplit);
	const edit = useReducer(reducers.editSplit);
	const remove = useReducer(reducers.deleteSplit);
	return { create, edit, remove };
}
