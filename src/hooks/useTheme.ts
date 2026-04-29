import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const THEME_MAP: Record<"light" | "dark", string> = {
	light: "silk",
	dark: "dim",
};

function applyTheme(theme: Theme) {
	if (theme === "system") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", THEME_MAP[theme]);
	}
}

function readStored(): Theme {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
	const [theme, setThemeState] = useState<Theme>(readStored);

	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	function setTheme(next: Theme) {
		localStorage.setItem(STORAGE_KEY, next);
		setThemeState(next);
	}

	return { theme, setTheme };
}
