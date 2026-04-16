import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useDebtActions() {
	const create = useReducer(reducers.createDebt);
	const remove = useReducer(reducers.deleteDebt);
	const settle = useReducer(reducers.settleDebt);
	return { create, remove, settle };
}
