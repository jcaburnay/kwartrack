import type { Session, User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
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
			if (data.session) loadProfile(data.session.user.id);
			setIsLoading(false);
		});

		const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
			if (!active) return;
			setSession(next);
			if (next) loadProfile(next.user.id);
			else setProfile(null);
		});

		return () => {
			active = false;
			subscription.subscription.unsubscribe();
		};
	}, [loadProfile]);

	const userId = session?.user.id;
	useEffect(() => {
		if (!userId) return;
		return subscribeTransactionRealtime(userId);
	}, [userId]);

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
	}, []);

	const setSessionOptimistically = useCallback(
		(next: Session | null) => {
			setSession(next);
			if (next) loadProfile(next.user.id);
			else setProfile(null);
		},
		[loadProfile],
	);

	const value: AuthContextValue = {
		session,
		user: session?.user ?? null,
		profile,
		isLoading,
		signOut,
		setSessionOptimistically,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
	return ctx;
}
