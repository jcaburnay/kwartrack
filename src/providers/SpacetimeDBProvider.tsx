import { useMemo } from "react";
import { SpacetimeDBProvider as StdbProvider } from "spacetimedb/react";
import { DbConnection } from "../module_bindings";
import { useClerkIdentity } from "./ClerkTokenProvider";

const SPACETIMEDB_URI = import.meta.env.VITE_SPACETIMEDB_URI ?? "wss://maincloud.spacetimedb.com";
const MODULE_NAME = import.meta.env.VITE_SPACETIMEDB_MODULE ?? "kwartrack";
const TOKEN_KEY = "spacetimedb_token";

export function SpacetimeDBProvider({ children }: { children: React.ReactNode }) {
	const { clerkUserId, displayName } = useClerkIdentity();

	// Use persisted SpacetimeDB token so identity stays stable across refreshes.
	// Clerk JWT is NOT a valid SpacetimeDB token — using it causes a new anonymous
	// identity on every connection (tested 2026-04-16 on kwartrack-dev).
	// biome-ignore lint/correctness/useExhaustiveDependencies: clerkUserId/displayName are stable once SpacetimeDBGate allows rendering — reconnecting on identity change would break the session
	const connectionBuilder = useMemo(() => {
		const storedToken = localStorage.getItem(TOKEN_KEY) ?? undefined;

		return DbConnection.builder()
			.withUri(SPACETIMEDB_URI)
			.withDatabaseName(MODULE_NAME)
			.onConnect((conn) => {
				// Persist the SpacetimeDB-issued token so the same identity is reused next session
				if (conn.token) {
					localStorage.setItem(TOKEN_KEY, conn.token);
				}

				// Link Clerk user ID to this SpacetimeDB identity (D-09 data privacy)
				// clerkUserId is guaranteed to be available — SpacetimeDBGate blocks rendering until Clerk is ready
				if (clerkUserId) {
					conn.reducers.linkClerkIdentity({
						clerkUserId,
						displayName: displayName ?? clerkUserId,
					});
				}

				conn
					.subscriptionBuilder()
					// biome-ignore lint/suspicious/noConsole: intentional error logging
					.onError((e) => console.error("[SpacetimeDB] Subscription error:", e))
					.subscribe([
						"SELECT * FROM my_accounts",
						"SELECT * FROM my_sub_accounts",
						"SELECT * FROM user_profile",
						"SELECT * FROM my_transactions",
						"SELECT * FROM my_recurring_definitions",
						"SELECT * FROM my_budget_config",
						"SELECT * FROM my_budget_allocations",
						"SELECT * FROM my_debts",
						"SELECT * FROM my_split_events",
						"SELECT * FROM my_split_participants",
						"SELECT * FROM my_tag_configs",
					]);

				// TD metadata in its own subscription so a view error cannot
				// take down the core subscription and break transactions/accounts.
				conn
					.subscriptionBuilder()
					// biome-ignore lint/suspicious/noConsole: intentional error logging
					.onError((e) => console.error("[SpacetimeDB] TD metadata subscription error:", e))
					.subscribe(["SELECT * FROM my_time_deposit_metadata"]);
			})
			.onDisconnect(() => {})
			.withToken(storedToken ?? "");
	}, []); // Only build once — clerkUserId is stable once gate allows rendering

	return <StdbProvider connectionBuilder={connectionBuilder}>{children}</StdbProvider>;
}
