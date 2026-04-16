import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useRecurringActions() {
	const create = useReducer(reducers.createRecurringDefinition);
	const edit = useReducer(reducers.editRecurringDefinition);
	const remove = useReducer(reducers.deleteRecurringDefinition);
	const pause = useReducer(reducers.pauseRecurringDefinition);
	const resume = useReducer(reducers.resumeRecurringDefinition);
	return { create, edit, remove, pause, resume };
}
