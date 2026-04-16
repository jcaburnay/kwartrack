import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useBudgetActions() {
	const setBudget = useReducer(reducers.setBudget);
	const setAllocations = useReducer(reducers.setBudgetAllocations);
	return { setBudget, setAllocations };
}
