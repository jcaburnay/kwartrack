import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AccountGroup } from "../utils/accountBalances";

type State = {
	groups: AccountGroup[];
	isLoading: boolean;
	error: string | null;
};

export function useAccountGroups() {
	const [state, setState] = useState<State>({ groups: [], isLoading: true, error: null });

	const refetch = useCallback(async () => {
		const { data, error } = await supabase
			.from("account_group")
			.select("*")
			.order("name", { ascending: true });
		if (error) {
			setState((s) => ({ ...s, isLoading: false, error: error.message }));
			return;
		}
		setState({ groups: data ?? [], isLoading: false, error: null });
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	return { ...state, refetch };
}
