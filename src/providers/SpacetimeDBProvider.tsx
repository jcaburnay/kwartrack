import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { SpacetimeDBProvider as StdbProvider } from "spacetimedb/react";
import { DbConnection } from "../module_bindings";
import { useClerkIdentity } from "./ClerkTokenProvider";

type ReconnectStatus = "connected" | "reconnecting" | "disconnected";

interface ReconnectContextValue {
	status: ReconnectStatus;
	retryNow: () => void;
}

const ReconnectContext = createContext<ReconnectContextValue | null>(null);

export function useReconnect(): ReconnectContextValue {
	const ctx = useContext(ReconnectContext);
	if (!ctx) throw new Error("useReconnect must be used within SpacetimeDBProvider");
	return ctx;
}

const MAX_RETRIES = 10;
const MAX_BACKOFF_MS = 30_000;

const SPACETIMEDB_URI = import.meta.env.VITE_SPACETIMEDB_URI ?? "wss://maincloud.spacetimedb.com";
const MODULE_NAME = import.meta.env.VITE_SPACETIMEDB_MODULE ?? "kwartrack";
const TOKEN_KEY = "spacetimedb_token";
const TOKEN_OWNER_KEY = "spacetimedb_token_owner";

export function SpacetimeDBProvider({ children }: { children: React.ReactNode }) {
	const { clerkUserId, displayName } = useClerkIdentity();
	const [reconnectKey, setReconnectKey] = useState(0);
	const [reconnectStatus, setReconnectStatus] = useState<ReconnectStatus>("connected");
	const attemptRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const scheduleReconnect = useCallback(() => {
		if (attemptRef.current >= MAX_RETRIES) {
			setReconnectStatus("disconnected");
			return;
		}
		setReconnectStatus("reconnecting");
		const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_BACKOFF_MS);
		attemptRef.current += 1;
		timerRef.current = setTimeout(() => setReconnectKey((k) => k + 1), delay);
	}, []);

	const retryNow = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		attemptRef.current = 0;
		setReconnectStatus("reconnecting");
		setReconnectKey((k) => k + 1);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: displayName updates flow through linkClerkIdentity on the live connection; reconnectKey triggers reconnection
	const connectionBuilder = useMemo(() => {
		// Only reuse a cached token if it belongs to the currently signed-in Clerk user.
		// Prevents User2 from inheriting User1's SpacetimeDB identity on the same browser.
		const storedToken = localStorage.getItem(TOKEN_KEY);
		const storedOwner = localStorage.getItem(TOKEN_OWNER_KEY);
		const reusableToken =
			storedToken && storedOwner && storedOwner === clerkUserId ? storedToken : undefined;
		if (!reusableToken && (storedToken || storedOwner)) {
			localStorage.removeItem(TOKEN_KEY);
			localStorage.removeItem(TOKEN_OWNER_KEY);
		}

		// Append reconnect key to URI to force a new ConnectionManager entry on each retry.
		// The query param is dropped when constructing WebSocket URLs (used as base URL),
		// so the actual connection is unaffected.
		const uri = reconnectKey > 0 ? `${SPACETIMEDB_URI}?_r=${reconnectKey}` : SPACETIMEDB_URI;

		return DbConnection.builder()
			.withUri(uri)
			.withDatabaseName(MODULE_NAME)
			.onConnect((conn) => {
				// Persist the SpacetimeDB-issued token and tag it with the Clerk user it belongs to
				if (conn.token && clerkUserId) {
					localStorage.setItem(TOKEN_KEY, conn.token);
					localStorage.setItem(TOKEN_OWNER_KEY, clerkUserId);
				}

				// Link Clerk user ID to this SpacetimeDB identity
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

				// Reset reconnection state on successful connect
				attemptRef.current = 0;
				setReconnectStatus("connected");
			})
			.onDisconnect(() => {
				// biome-ignore lint/suspicious/noConsole: intentional debug logging
				console.warn("[SpacetimeDB] Disconnected — scheduling reconnect");
				scheduleReconnect();
			})
			.onConnectError(() => {
				// onDisconnect does NOT fire when a reconnect attempt fails to connect.
				// Only onConnectError fires in that case. Both must trigger the backoff chain.
				// biome-ignore lint/suspicious/noConsole: intentional debug logging
				console.warn("[SpacetimeDB] Connect error — scheduling reconnect");
				scheduleReconnect();
			})
			.withToken(reusableToken ?? "");
	}, [reconnectKey, clerkUserId]);

	// Cleanup backoff timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const reconnectValue = useMemo(
		() => ({ status: reconnectStatus, retryNow }),
		[reconnectStatus, retryNow],
	);

	return (
		<ReconnectContext.Provider value={reconnectValue}>
			<StdbProvider connectionBuilder={connectionBuilder}>{children}</StdbProvider>
		</ReconnectContext.Provider>
	);
}
