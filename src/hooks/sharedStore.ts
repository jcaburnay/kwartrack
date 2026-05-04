import { useEffect, useSyncExternalStore } from "react";
import { useVersion } from "./useTransactionVersion";

type TableName = "transaction" | "account" | "debt" | "split_event";

type State<T> = {
	data: T;
	isLoading: boolean;
	error: string | null;
};

export type SharedStore<T> = {
	useStore: () => State<T> & { refetch: () => Promise<void> };
	refetch: () => Promise<void>;
	reset: () => void;
};

/**
 * Module-level cache + listener-based store for queries that multiple panels
 * share. Replaces the per-component fetch pattern where N panels independently
 * fired the same Supabase query on mount. With this:
 *
 *   - The first subscriber triggers the fetch.
 *   - Concurrent subscribers piggyback on the in-flight promise (no duplicate
 *     network calls).
 *   - All subscribers re-render together when the store updates.
 *   - On a bump of any of `invalidatesOn` tables, the store re-fetches once
 *     and fans out to all subscribers.
 *
 * `invalidatesOn` is required so each store explicitly opts into
 * invalidation — otherwise hooks (tags/persons/groups) silently picked up
 * tx-version invalidation through this helper and refetched needlessly.
 * Pass `[]` for queries that only need to fetch on mount (and on explicit
 * mutation refetches via the returned `refetch` callback).
 *
 * Call `reset()` from sign-out / user-change flows to clear cross-user leaks.
 */
export function createSharedStore<T>(
	fetcher: () => Promise<T>,
	initial: T,
	invalidatesOn: readonly TableName[] = [],
): SharedStore<T> {
	let state: State<T> = { data: initial, isLoading: true, error: null };
	let inflight: Promise<void> | null = null;
	let lastVersion = -1;
	const listeners = new Set<() => void>();

	const subscribe = (cb: () => void): (() => void) => {
		listeners.add(cb);
		return () => {
			listeners.delete(cb);
		};
	};
	const getSnapshot = (): State<T> => state;

	const refetch = (): Promise<void> => {
		if (inflight) return inflight;
		inflight = fetcher()
			.then((data) => {
				state = { data, isLoading: false, error: null };
			})
			.catch((e: unknown) => {
				state = {
					...state,
					isLoading: false,
					error: e instanceof Error ? e.message : String(e),
				};
			})
			.finally(() => {
				inflight = null;
				for (const fn of listeners) fn();
			});
		return inflight;
	};

	const ensureFresh = (version: number): void => {
		if (lastVersion === version && state.error == null && !inflight) return;
		lastVersion = version;
		void refetch();
	};

	const reset = (): void => {
		state = { data: initial, isLoading: true, error: null };
		lastVersion = -1;
		for (const fn of listeners) fn();
	};

	const useStore = () => {
		const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
		const version = useVersion(invalidatesOn);
		useEffect(() => {
			ensureFresh(version);
		}, [version]);
		return { ...snap, refetch };
	};

	return { useStore, refetch, reset };
}

const allResetters = new Set<() => void>();

export function registerSharedStore(reset: () => void): void {
	allResetters.add(reset);
}

/** Call from AuthProvider on sign-out / user change to clear all caches. */
export function resetAllSharedStores(): void {
	for (const reset of allResetters) reset();
}

/**
 * Same idea as createSharedStore, but the cache is keyed (e.g. by month). Each
 * key gets its own store, lazily created on first use. Useful for queries that
 * are scoped to a parameter — multiple panels asking about the same month
 * share, while different months stay isolated.
 */
export function createKeyedSharedStore<K extends string, T>(
	fetcherForKey: (key: K) => Promise<T>,
	initial: T,
	invalidatesOn: readonly TableName[] = [],
) {
	const stores = new Map<K, SharedStore<T>>();
	const get = (key: K): SharedStore<T> => {
		let store = stores.get(key);
		if (!store) {
			store = createSharedStore(() => fetcherForKey(key), initial, invalidatesOn);
			stores.set(key, store);
		}
		return store;
	};
	const resetAll = () => {
		for (const s of stores.values()) s.reset();
	};
	registerSharedStore(resetAll);
	return {
		useStore: (key: K) => get(key).useStore(),
		refetch: (key: K) => get(key).refetch(),
		resetAll,
	};
}
