import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export const THEMES = [
	"system",
	"light",
	"dark",
	"corporate",
	"business",
	"emerald",
	"cupcake",
	"lemonade",
	"winter",
	"night",
	"dim",
] as const;

export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "theme";

function isTheme(value: unknown): value is Theme {
	return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

// `system` resolves to a daisyUI theme based on the OS preference. Corporate/
// business were the v1 defaults, so we keep them as the system-resolved themes
// to preserve the brand palette for users who never explicitly choose.
export function resolveTheme(theme: Theme): string {
	if (theme !== "system") return theme;
	const prefersDark =
		typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
	return prefersDark ? "business" : "corporate";
}

function applyTheme(theme: Theme) {
	document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}

function readStored(): Theme {
	if (typeof window === "undefined") return "system";
	const stored = window.localStorage.getItem(STORAGE_KEY);
	return isTheme(stored) ? stored : "system";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
	const { user, profile, patchProfileOptimistic } = useAuth();
	const [localTheme, setLocalTheme] = useState<Theme>(readStored);

	// Server-stored theme wins when present so the choice follows the user
	// across devices. localStorage is the pre-auth + optimistic fallback.
	const theme = useMemo<Theme>(
		() => (isTheme(profile?.theme) ? (profile.theme as Theme) : localTheme),
		[profile?.theme, localTheme],
	);

	useEffect(() => {
		applyTheme(theme);
		if (theme !== "system") return;
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [theme]);

	const setTheme = useCallback(
		(next: Theme) => {
			window.localStorage.setItem(STORAGE_KEY, next);
			setLocalTheme(next);
			if (user) {
				patchProfileOptimistic({ theme: next });
				void supabase.from("user_profile").update({ theme: next }).eq("id", user.id);
			}
		},
		[user, patchProfileOptimistic],
	);

	return { theme, setTheme };
}
