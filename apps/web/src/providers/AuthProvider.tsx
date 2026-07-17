import type { Session, User } from "@supabase/supabase-js";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { resetAllSharedStores } from "../hooks/sharedStore";
import { subscribeTransactionRealtime } from "../hooks/useTransactionRealtime";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";

type UserProfile = Database["public"]["Tables"]["user_profile"]["Row"];

type AuthContextValue = {
	session: Session | null;
	user: User | null;
	profile: UserProfile | null;
	isLoading: boolean;
	signOut: () => Promise<void>;
	setSessionOptimistically: (session: Session | null) => void;
	refreshProfile: () => Promise<void>;
	patchProfileOptimistic: (patch: Partial<UserProfile>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const loadProfile = useCallback(async (userId: string) => {
		const { data, error } = await supabase
			.from("user_profile")
			.select("*")
			.eq("id", userId)
			.maybeSingle();
		if (error) {
			// biome-ignore lint/suspicious/noConsole: surface profile-fetch failures in dev; swap for proper telemetry later.
			console.error("Failed to load user_profile", error);
			setProfile(null);
			return;
		}
		setProfile(data);
	}, []);

	useEffect(() => {
		let active = true;

		supabase.auth.getSession().then(({ data }) => {
			if (!active) return;
			setSession(data.session);
			setIsLoading(false);
		});

		const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
			if (!active) return;
			setSession(next);
		});

		return () => {
			active = false;
			subscription.subscription.unsubscribe();
		};
	}, []);

	const userId = session?.user.id;
	// Load the profile once per signed-in user. Splitting this from the session
	// effect avoids the duplicate fetch when getSession() and onAuthStateChange()
	// both fire for the same session on initial load.
	useEffect(() => {
		if (!userId) {
			setProfile(null);
			resetAllSharedStores();
			return;
		}
		loadProfile(userId);
	}, [userId, loadProfile]);

	useEffect(() => {
		if (!userId) return;
		// Defer the WebSocket setup until after the initial paint so it doesn't
		// compete with critical-path work. requestIdleCallback where available,
		// setTimeout(0) as a fallback for older Safari.
		let teardown: (() => void) | null = null;
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (handle: number) => void;
		};
		const handle = win.requestIdleCallback
			? win.requestIdleCallback(
					() => {
						teardown = subscribeTransactionRealtime(userId);
					},
					{ timeout: 2000 },
				)
			: window.setTimeout(() => {
					teardown = subscribeTransactionRealtime(userId);
				}, 0);
		return () => {
			if (win.cancelIdleCallback && typeof handle === "number") {
				win.cancelIdleCallback(handle);
			} else {
				window.clearTimeout(handle as number);
			}
			teardown?.();
		};
	}, [userId]);

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
	}, []);

	const setSessionOptimistically = useCallback((next: Session | null) => {
		setSession(next);
	}, []);

	const refreshProfile = useCallback(async () => {
		if (!userId) return;
		await loadProfile(userId);
	}, [userId, loadProfile]);

	const patchProfileOptimistic = useCallback((patch: Partial<UserProfile>) => {
		setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user: session?.user ?? null,
			profile,
			isLoading,
			signOut,
			setSessionOptimistically,
			refreshProfile,
			patchProfileOptimistic,
		}),
		[
			session,
			profile,
			isLoading,
			signOut,
			setSessionOptimistically,
			refreshProfile,
			patchProfileOptimistic,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
	return ctx;
}
