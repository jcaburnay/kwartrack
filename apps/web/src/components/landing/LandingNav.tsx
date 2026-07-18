import { Code, Moon, Sun } from "lucide-react";
import { Link } from "react-router";
import { resolveTheme, useTheme } from "../../hooks/useTheme";
import { GITHUB_URL } from "./content";

const DARK_THEMES = new Set(["dark", "business", "night", "dim"]);

export function LandingNav() {
	const { theme, setTheme } = useTheme();
	const isDark = DARK_THEMES.has(resolveTheme(theme));

	return (
		<header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/80 backdrop-blur">
			<nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
				<Link to="/" className="font-semibold text-lg">
					<span className="text-primary">₱</span> Kwartrack
				</Link>

				<div className="ml-auto flex items-center gap-1 sm:gap-2">
					<a href="#features" className="btn btn-ghost btn-sm hidden sm:inline-flex">
						Features
					</a>
					<a href="#self-host" className="btn btn-ghost btn-sm hidden sm:inline-flex">
						Self-host
					</a>
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noreferrer"
						className="btn btn-ghost btn-sm"
						aria-label="GitHub repository"
					>
						<Code className="size-4" />
					</a>
					<button
						type="button"
						className="btn btn-ghost btn-sm btn-square"
						aria-label="Toggle theme"
						onClick={() => setTheme(isDark ? "light" : "dark")}
					>
						{isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
					</button>
					<Link to="/signin" className="btn btn-ghost btn-sm">
						Sign in
					</Link>
					<Link to="/signup" className="btn btn-primary btn-sm">
						Get started
					</Link>
				</div>
			</nav>
		</header>
	);
}
