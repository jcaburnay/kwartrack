import { useAuth, useUser } from "@clerk/react";
import { createContext, useContext, useEffect, useState } from "react";

const TokenContext = createContext<string | undefined>(undefined);

export function useClerkToken() {
	return useContext(TokenContext);
}

export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
	const { isLoaded, isSignedIn, getToken } = useAuth();
	const { user } = useUser();
	const [token, setToken] = useState<string | undefined>(undefined);

	useEffect(() => {
		async function refreshToken() {
			if (!isLoaded || !isSignedIn || !user) {
				// Clear stored identity on sign-out
				localStorage.removeItem("clerk_user_id");
				localStorage.removeItem("clerk_display_name");
				setToken(undefined);
				return;
			}
			// Persist Clerk user ID for SpacetimeDBProvider to read (D-09 identity linking)
			localStorage.setItem("clerk_user_id", user.id);
			localStorage.setItem("clerk_display_name", user.fullName ?? user.id);

			const t = await getToken();
			setToken(t ?? undefined);
		}
		refreshToken();

		// Poll every 55 minutes to refresh token before 1-hour Clerk JWT expiry (Pitfall 2)
		const interval = setInterval(refreshToken, 55 * 60 * 1000);
		return () => clearInterval(interval);
	}, [isLoaded, isSignedIn, getToken, user]);

	return <TokenContext.Provider value={token}>{children}</TokenContext.Provider>;
}
