import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

export function useSubAccountActions() {
	const add = useReducer(reducers.addSubAccount);
	const convertAndCreate = useReducer(reducers.convertAndCreateSubAccount);
	const edit = useReducer(reducers.editSubAccount);
	const remove = useReducer(reducers.deleteSubAccount);
	const rename = useReducer(reducers.renameSubAccount);
	const createTimeDeposit = useReducer(reducers.createTimeDeposit);
	const editTimeDepositMetadata = useReducer(reducers.editTimeDepositMetadata);
	return {
		add,
		convertAndCreate,
		edit,
		remove,
		rename,
		createTimeDeposit,
		editTimeDepositMetadata,
	};
}
