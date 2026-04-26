import { NavLink } from "react-router";
import { useAuth } from "../providers/AuthProvider";

function initialsFrom(name: string | null | undefined): string {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/).slice(0, 2);
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const NAV = [
	{ to: "/", label: "Overview" },
	{ to: "/accounts", label: "Accounts" },
	{ to: "/budget", label: "Budget" },
	{ to: "/settings/groups", label: "Settings" },
];

export function Header() {
	const { profile, signOut } = useAuth();
	const displayName = profile?.display_name ?? "…";

	return (
		<header className="navbar bg-base-100 border-b border-base-300 flex-wrap gap-y-2">
			<div className="flex-1 flex items-center gap-4 flex-wrap">
				<span className="text-xl font-semibold px-2">kwartrack</span>
				<nav className="flex gap-1">
					{NAV.map((n) => (
						<NavLink
							key={n.to}
							to={n.to}
							end={n.to === "/"}
							className={({ isActive }) => `btn btn-sm btn-ghost ${isActive ? "btn-active" : ""}`}
						>
							{n.label}
						</NavLink>
					))}
				</nav>
			</div>
			<div className="flex-none flex items-center gap-3">
				<div className="flex items-center gap-2">
					<div className="avatar avatar-placeholder">
						<div className="bg-primary text-primary-content w-9 rounded-full">
							<span className="text-sm">{initialsFrom(profile?.display_name)}</span>
						</div>
					</div>
					<span className="hidden sm:inline text-sm text-base-content/80">{displayName}</span>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={() => signOut()}>
					Sign out
				</button>
			</div>
		</header>
	);
}
