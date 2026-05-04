import { useEffect, useSyncExternalStore } from "react";
import { useTransactionVersion } from "./useTransactionVersion";

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
 *   - On `txVersion` bump (mutations elsewhere), the store re-fetches once and
 *     fans out to all subscribers.
 *
 * Call `reset()` from sign-out / user-change flows to clear cross-user leaks.
 */
export function createSharedStore<T>(fetcher: () => Promise<T>, initial: T): SharedStore<T> {
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
		const txVersion = useTransactionVersion();
		useEffect(() => {
			ensureFresh(txVersion);
		}, [txVersion]);
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
