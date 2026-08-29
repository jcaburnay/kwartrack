import { Moon, Sun } from "lucide-react";
import { Link } from "react-router";
import { resolveTheme, useTheme } from "../../hooks/useTheme";
import { GITHUB_URL } from "./content";
import { GithubIcon } from "./GithubIcon";

const DARK_THEMES = new Set(["dark", "business", "night", "dim"]);

export function LandingNav() {
	const { theme, setTheme } = useTheme();
	const isDark = DARK_THEMES.has(resolveTheme(theme));

	return (
		<header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/80 backdrop-blur">
			<nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3">
				<Link to="/" className="shrink-0 font-semibold text-lg">
					<span className="text-primary">₱</span> Kwartrack
				</Link>

				<div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
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
						className="btn btn-ghost btn-sm hidden sm:inline-flex"
						aria-label="GitHub repository"
					>
						<GithubIcon className="size-4" />
					</a>
					<button
						type="button"
						className="btn btn-ghost btn-sm btn-square size-11 sm:size-8"
						aria-label="Toggle theme"
						onClick={() => setTheme(isDark ? "corporate" : "business")}
					>
						{isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
					</button>
					<Link to="/signin" className="btn btn-ghost btn-sm h-11 px-2.5 sm:h-8 sm:px-3">
						Sign in
					</Link>
					<Link
						to="/signup"
						aria-label="Get started"
						className="btn btn-primary btn-sm h-11 px-3 sm:h-8"
					>
						<span aria-hidden="true" className="sm:hidden">
							Start
						</span>
						<span aria-hidden="true" className="hidden sm:inline">
							Get started
						</span>
					</Link>
				</div>
			</nav>
		</header>
	);
}
