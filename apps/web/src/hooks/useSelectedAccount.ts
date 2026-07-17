import { useCallback } from "react";
import { useSearchParams } from "react-router";
import type { Account, AccountGroup } from "../utils/accountBalances";

export type Selection =
	| { kind: "none" }
	| { kind: "account"; account: Account }
	| { kind: "group"; group: AccountGroup };

export function useSelectedAccount(accounts: readonly Account[], groups: readonly AccountGroup[]) {
	const [params, setParams] = useSearchParams();
	const accountId = params.get("account");
	const groupId = params.get("group");

	let selection: Selection = { kind: "none" };
	if (accountId) {
		const a = accounts.find((x) => x.id === accountId);
		if (a) selection = { kind: "account", account: a };
	} else if (groupId) {
		const g = groups.find((x) => x.id === groupId);
		if (g) selection = { kind: "group", group: g };
	}

	const selectAccount = useCallback(
		(id: string | null) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete("group");
					if (id) next.set("account", id);
					else next.delete("account");
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	const selectGroup = useCallback(
		(id: string | null) => {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete("account");
					if (id) next.set("group", id);
					else next.delete("group");
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	const clear = useCallback(() => {
		setParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.delete("account");
				next.delete("group");
				return next;
			},
			{ replace: true },
		);
	}, [setParams]);

	return { selection, selectAccount, selectGroup, clear };
}
