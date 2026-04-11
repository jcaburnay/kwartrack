import { useUser } from "@clerk/react";
import { useEffect } from "react";
import { useReducer } from "spacetimedb/react";
import { reducers } from "../module_bindings";

/**
 * Reactively calls linkClerkIdentity whenever the Clerk user becomes available.
 * This is a fallback for the onConnect handler in SpacetimeDBProvider, which can
 * miss the call if Clerk hasn't finished initializing before the WebSocket connects
 * (e.g. after localStorage is cleared). The reducer is idempotent server-side.
 */
export function useClerkIdentityLink() {
	const { user } = useUser();
	const linkClerkIdentity = useReducer(reducers.linkClerkIdentity);

	useEffect(() => {
		if (!user) return;
		linkClerkIdentity({
			clerkUserId: user.id,
			displayName: user.fullName ?? user.id,
		});
	}, [user, linkClerkIdentity]);
}
