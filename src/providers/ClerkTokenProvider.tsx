import { useAuth, useUser } from "@clerk/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface ClerkContextValue {
	token: string | undefined;
	clerkUserId: string | undefined;
	displayName: string | undefined;
}

const ClerkContext = createContext<ClerkContextValue>({
	token: undefined,
	clerkUserId: undefined,
	displayName: undefined,
});

export function useClerkToken() {
	return useContext(ClerkContext).token;
}

export function useClerkIdentity() {
	const { clerkUserId, displayName } = useContext(ClerkContext);
	return { clerkUserId, displayName };
}

export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
	const { isLoaded, isSignedIn, getToken } = useAuth();
	const { user } = useUser();
	const [token, setToken] = useState<string | undefined>(undefined);

	useEffect(() => {
		async function refreshToken() {
			if (!isLoaded || !isSignedIn || !user) {
				setToken(undefined);
				return;
			}

			const t = await getToken();
			setToken(t ?? undefined);
		}
		refreshToken();

		// Poll every 55 minutes to refresh token before 1-hour Clerk JWT expiry
		const interval = setInterval(refreshToken, 55 * 60 * 1000);
		return () => clearInterval(interval);
	}, [isLoaded, isSignedIn, getToken, user]);

	const value = useMemo<ClerkContextValue>(
		() => ({
			token,
			clerkUserId: isLoaded && isSignedIn && user ? user.id : undefined,
			displayName: isLoaded && isSignedIn && user ? (user.fullName ?? user.id) : undefined,
		}),
		[token, isLoaded, isSignedIn, user],
	);

	return <ClerkContext.Provider value={value}>{children}</ClerkContext.Provider>;
}
