import { supabase } from "../lib/supabase";
import type { Account } from "../utils/accountBalances";
import { createSharedStore, registerSharedStore } from "./sharedStore";

const store = createSharedStore<Account[]>(async () => {
	const { data, error } = await supabase
		.from("account")
		.select("*")
		.order("name", { ascending: true });
	if (error) throw new Error(error.message);
	return data ?? [];
}, []);

registerSharedStore(store.reset);

export function useAccounts() {
	const { data, isLoading, error, refetch } = store.useStore();
	return { accounts: data, isLoading, error, refetch };
}
