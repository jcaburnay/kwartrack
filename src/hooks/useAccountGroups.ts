import { supabase } from "../lib/supabase";
import type { AccountGroup } from "../utils/accountBalances";
import { createSharedStore, registerSharedStore } from "./sharedStore";

const store = createSharedStore<AccountGroup[]>(async () => {
	const { data, error } = await supabase
		.from("account_group")
		.select("*")
		.order("name", { ascending: true });
	if (error) throw new Error(error.message);
	return data ?? [];
}, []);

registerSharedStore(store.reset);

export function useAccountGroups() {
	const { data, isLoading, error, refetch } = store.useStore();
	return { groups: data, isLoading, error, refetch };
}
