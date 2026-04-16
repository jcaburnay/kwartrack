import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useAccountActions() {
	const create = useReducer(reducers.createAccount);
	const rename = useReducer(reducers.renameAccount);
	const remove = useReducer(reducers.deleteAccount);
	return { create, rename, remove };
}
