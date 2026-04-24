import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Account } from "../utils/accountBalances";

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

	useEffect(() => {
		refetch();
	}, [refetch]);

	return { ...state, refetch };
}
