import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const [isDark, setIsDark] = useState(() => {
		return localStorage.getItem("theme") === "kwartrack-dark";
	});

	useEffect(() => {
		const theme = isDark ? "kwartrack-dark" : "kwartrack-light";
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("theme", theme);
	}, [isDark]);

	return (
		<button
			type="button"
			onClick={() => setIsDark(!isDark)}
			className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-base-300 bg-base-100 text-base-content/60 hover:text-base-content transition-colors cursor-pointer text-xs font-medium w-full"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{isDark ? <Sun size={14} /> : <Moon size={14} />}
			{isDark ? "Light mode" : "Dark mode"}
		</button>
	);
}
