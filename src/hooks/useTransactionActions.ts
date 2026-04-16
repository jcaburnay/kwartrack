import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useTransactionActions() {
	const create = useReducer(reducers.createTransaction);
	const edit = useReducer(reducers.editTransaction);
	const remove = useReducer(reducers.deleteTransaction);
	return { create, edit, remove };
}
