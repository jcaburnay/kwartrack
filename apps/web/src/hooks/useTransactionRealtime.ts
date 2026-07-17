import { supabase } from "../lib/supabase";
import { bumpVersion } from "./useTransactionVersion";

/**
 * Opens a single Supabase realtime channel for the signed-in user that listens
 * for `postgres_changes` on the `transaction` and `account` tables and bumps
 * the matching table version. This catches mutations that don't originate from
 * the current tab — server-side cron-fired recurrings, edits in another tab,
 * edits on another device.
 *
 * Returns a teardown that removes the channel; the caller (AuthProvider) is
 * responsible for invoking it on sign-out / user change / unmount.
 *
 * The `user_id=eq.${userId}` filter is the primary scoping mechanism for
 * `postgres_changes` — the Realtime server filters events server-side before
 * delivery. RLS still applies to any subsequent reads the bumped hooks fire,
 * but don't drop this filter on the assumption RLS will catch leaks.
 */
export function subscribeTransactionRealtime(userId: string): () => void {
	const filter = `user_id=eq.${userId}`;
	const channel = supabase
		.channel(`transactions:${userId}`)
		.on("postgres_changes", { event: "*", schema: "public", table: "transaction", filter }, () => {
			bumpVersion("transaction");
		})
		.on("postgres_changes", { event: "*", schema: "public", table: "account", filter }, () => {
			bumpVersion("account");
		})
		.subscribe();

	return () => {
		void supabase.removeChannel(channel);
	};
}
