import { useEffect, useState } from "react";

/**
 * Per-table "version" counters incremented on any mutation to a watched table.
 * Read-side hooks subscribe via `useVersion(tables)` and re-run their fetch
 * effect when any of those tables bumps. Replaces the old single global
 * tripwire so e.g. tag/recurring caches don't refetch on transaction events
 * they have no dependency on.
 *
 * Also catches mutations originating from this browser session AND server-side
 * (the realtime channel calls `bumpVersion(table)` on postgres_changes events).
 *
 * Backward-compatible exports:
 *   - `bumpTransactionVersion()` bumps both `transaction` and `account`
 *     (covering the common case where a transaction mutation triggers
 *     account.balance_centavos updates via DB triggers).
 *   - `useTransactionVersion()` subscribes to both for callers that want the
 *     legacy "any tx-shaped change" tick.
 */

type TableName = "transaction" | "account" | "debt" | "split_event";

const versions: Record<TableName, number> = {
	transaction: 0,
	account: 0,
	debt: 0,
	split_event: 0,
};
const listeners: Record<TableName, Set<() => void>> = {
	transaction: new Set(),
	account: new Set(),
	debt: new Set(),
	split_event: new Set(),
};

export function bumpVersion(table: TableName): void {
	versions[table] += 1;
	for (const fn of listeners[table]) fn();
}

/**
 * Bumps the `transaction` table version. Mutation sites that insert or edit
 * transactions should call this; account.balance_centavos cascades happen at
 * the DB level and useAccounts subscribes to `transaction` invalidation as
 * well, so a single bump catches both reads.
 */
export function bumpTransactionVersion(): void {
	bumpVersion("transaction");
}

/**
 * Subscribe to bumps on any of the given tables and return a numeric tick
 * that increments whenever one of those tables fires. Pass a stable array
 * reference (module-level constant or memoized) — the tracker re-subscribes
 * on identity change.
 */
export function useVersion(tables: readonly TableName[]): number {
	const [, setN] = useState(0);
	useEffect(() => {
		const sub = () => setN((n) => n + 1);
		for (const t of tables) listeners[t].add(sub);
		return () => {
			for (const t of tables) listeners[t].delete(sub);
		};
	}, [tables]);
	let v = 0;
	for (const t of tables) v += versions[t];
	return v;
}

const TX_AND_ACCOUNT: readonly TableName[] = ["transaction", "account"];

/** Back-compat alias: subscribe to transaction + account bumps. */
export function useTransactionVersion(): number {
	return useVersion(TX_AND_ACCOUNT);
}
