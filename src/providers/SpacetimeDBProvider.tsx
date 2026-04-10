import { useMemo } from "react";
import { SpacetimeDBProvider as StdbProvider } from "spacetimedb/react";
import { DbConnection } from "../module_bindings";

const SPACETIMEDB_URI = import.meta.env.VITE_SPACETIMEDB_URI ?? "wss://maincloud.spacetimedb.com";
const MODULE_NAME = import.meta.env.VITE_SPACETIMEDB_MODULE ?? "kwartrack";
const TOKEN_KEY = "spacetimedb_token";

export function SpacetimeDBProvider({ children }: { children: React.ReactNode }) {
	// Use persisted SpacetimeDB token so identity stays stable across refreshes.
	// Clerk JWT is NOT a valid SpacetimeDB token — using it causes a new anonymous
	// identity on every connection, so my_accounts (filtered by ctx.sender) returns empty.
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
				// Ensures same Clerk user sees same data across devices/sessions
				const clerkUserId = localStorage.getItem("clerk_user_id");
				const displayName = localStorage.getItem("clerk_display_name") ?? clerkUserId ?? "";
				if (clerkUserId) {
					conn.reducers.linkClerkIdentity({ clerkUserId, displayName });
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
			})
			.onDisconnect(() => {})
			.withToken(storedToken ?? "");
	}, []); // Only build once — token is read from localStorage directly

	return <StdbProvider connectionBuilder={connectionBuilder}>{children}</StdbProvider>;
}
