import { NavLink } from "react-router";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../providers/AuthProvider";
import { GlobalFab } from "./GlobalFab";
import { MobileDock } from "./MobileDock";

function initialsFrom(name: string | null | undefined): string {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/).slice(0, 2);
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Header() {
	const { profile, signOut } = useAuth();
	const { theme, setTheme } = useTheme();
	const displayName = profile?.display_name ?? "…";

	return (
		<>
			<header className="navbar bg-base-100 border-b border-base-300">
				<div className="flex-1">
					<NavLink
						to="/"
						aria-label="Go to home"
						className="text-xl font-medium px-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						kwartrack
					</NavLink>
				</div>

				<div className="flex-none">
					<div className="dropdown dropdown-end">
						<button
							type="button"
							tabIndex={0}
							aria-label="Open account menu"
							aria-haspopup="menu"
							className="avatar avatar-placeholder cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-full"
						>
							<div className="bg-primary text-primary-content w-9 rounded-full">
								<span className="text-sm">{initialsFrom(displayName)}</span>
							</div>
						</button>
						<ul
							tabIndex={0}
							aria-label="Account menu"
							className="dropdown-content menu bg-base-100 rounded-box shadow-md z-50 w-52 p-2 mt-2"
						>
							<li className="menu-title text-xs font-normal text-base-content/60 px-3 py-1">
								{displayName}
							</li>
							<li aria-hidden="true" className="-mx-2 my-1 border-t border-base-content/10" />
							<li>
								<span
									className="text-xs font-medium text-base-content/50 uppercase tracking-wide px-3 py-1 cursor-default pointer-events-none"
									aria-hidden="true"
								>
									Theme
								</span>
							</li>
							{(["system", "light", "dark"] as const).map((t) => (
								<li key={t}>
									<button
										type="button"
										aria-pressed={theme === t}
										className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm capitalize hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${theme === t ? "active font-medium" : ""}`}
										onClick={() => setTheme(t)}
									>
										<span>{t}</span>
										{theme === t && (
											<span className="text-xs opacity-60" aria-hidden="true">
												✓
											</span>
										)}
									</button>
								</li>
							))}
							<li aria-hidden="true" className="-mx-2 my-1 border-t border-base-content/10" />
							<li>
								<NavLink to="/settings">Settings</NavLink>
							</li>
							<li>
								<button type="button" onClick={() => signOut()}>
									Sign out
								</button>
							</li>
						</ul>
					</div>
				</div>
			</header>
			<MobileDock />
			<GlobalFab />
		</>
	);
}
