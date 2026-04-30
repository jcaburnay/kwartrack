import { useEffect, useState } from "react";

/**
 * Module-level "transaction version" counter, incremented on any mutation to
 * the `transaction` table (insert/update/delete, or RPCs that create
 * transactions like `settle_debt`). Read-side hooks (`useTransactions`,
 * `useBudget`, `useBudgetOverage`, `useMonthlySpendTrend`) subscribe via
 * `useTransactionVersion()` and re-run their fetch effect when the version
 * changes, so a transaction edited in one panel refreshes derived views
 * (budget actuals, cash-flow trends, MTD delta) in sibling panels without
 * prop drilling.
 *
 * NOT a replacement for Supabase realtime. Only catches mutations that
 * originate from this browser session — not external changes (cron-fired
 * recurrings, edits in other tabs/devices).
 */

let version = 0;
const listeners = new Set<(v: number) => void>();

export function bumpTransactionVersion(): void {
	version += 1;
	for (const fn of listeners) fn(version);
}

export function useTransactionVersion(): number {
	const [v, setV] = useState(version);
	useEffect(() => {
		listeners.add(setV);
		return () => {
			listeners.delete(setV);
		};
	}, []);
	return v;
}
