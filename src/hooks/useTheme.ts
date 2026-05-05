import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const THEME_MAP: Record<"light" | "dark", string> = {
	light: "corporate",
	dark: "business",
};

function applyTheme(theme: Theme) {
	const resolved =
		theme === "system"
			? window.matchMedia("(prefers-color-scheme: dark)").matches
				? THEME_MAP.dark
				: THEME_MAP.light
			: THEME_MAP[theme];
	document.documentElement.setAttribute("data-theme", resolved);
}

function readStored(): Theme {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
	const [theme, setThemeState] = useState<Theme>(readStored);

	useEffect(() => {
		applyTheme(theme);
		// While in "system" mode, react to OS-level light/dark changes so the
		// resolved DaisyUI theme (and our `[data-theme="..."]` color overrides)
		// stay in sync.
		if (theme !== "system") return;
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [theme]);

	function setTheme(next: Theme) {
		localStorage.setItem(STORAGE_KEY, next);
		setThemeState(next);
	}

	return { theme, setTheme };
}
