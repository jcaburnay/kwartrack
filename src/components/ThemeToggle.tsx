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

	const label = isDark ? "Light mode" : "Dark mode";

	return (
		<button
			type="button"
			onClick={() => setIsDark(!isDark)}
			className="is-drawer-close:tooltip is-drawer-close:tooltip-right flex items-center gap-2.5 w-full rounded-lg text-base-content/60 hover:text-base-content transition-colors cursor-pointer text-sm"
			aria-label={label}
			data-tip={label}
		>
			{isDark ? (
				<Sun size={18} className="my-1.5 shrink-0" />
			) : (
				<Moon size={18} className="my-1.5 shrink-0" />
			)}
			<span className="is-drawer-close:hidden whitespace-nowrap">{label}</span>
		</button>
	);
}
