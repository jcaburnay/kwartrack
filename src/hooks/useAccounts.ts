import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Account } from "../utils/accountBalances";
import { useTransactionVersion } from "./useTransactionVersion";

type State = {
	accounts: Account[];
	isLoading: boolean;
	error: string | null;
};

export function useAccounts() {
	const [state, setState] = useState<State>({ accounts: [], isLoading: true, error: null });

	const refetch = useCallback(async () => {
		const { data, error } = await supabase
			.from("account")
			.select("*")
			.order("name", { ascending: true });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({ accounts: data ?? [], isLoading: false, error: null });
	}, []);

	const txVersion = useTransactionVersion();
	// biome-ignore lint/correctness/useExhaustiveDependencies: txVersion is a tripwire — DB triggers update account.balance_centavos when transactions mutate, so refetch when the version bumps.
	useEffect(() => {
		refetch();
	}, [refetch, txVersion]);

	return { ...state, refetch };
}
