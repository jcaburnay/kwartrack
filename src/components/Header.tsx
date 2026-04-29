import { NavLink } from "react-router";
import { useBudgetOverage } from "../hooks/useBudgetOverage";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../providers/AuthProvider";
import { GlobalFab } from "./GlobalFab";
import { MobileDock } from "./MobileDock";

function initialsFrom(name: string | null | undefined): string {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/).slice(0, 2);
	return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

type NavIndicator = "loaned" | "budget";

const NAV: { to: string; label: string; indicator?: NavIndicator }[] = [
	{ to: "/", label: "Overview" },
	{ to: "/accounts", label: "Accounts" },
	{ to: "/budget", label: "Budget", indicator: "budget" },
	{ to: "/recurring", label: "Recurring" },
	{ to: "/debts-and-splits", label: "Debts & Splits", indicator: "loaned" },
];

export function Header() {
	const { profile, signOut } = useAuth();
	const { hasUnsettledLoaned } = useDebtsAndSplits();
	const hasBudgetOverage = useBudgetOverage();
	const { theme, setTheme } = useTheme();
	const displayName = profile?.display_name ?? "…";

	function showIndicator(kind: NavIndicator | undefined): boolean {
		if (kind === "loaned") return hasUnsettledLoaned;
		if (kind === "budget") return hasBudgetOverage;
		return false;
	}

	const indicatorLabel: Record<NavIndicator, string> = {
		loaned: "(unsettled debts)",
		budget: "(over budget)",
	};

	return (
		<>
			<header className="navbar bg-base-100 border-b border-base-300 flex-wrap gap-y-2">
				<div className="flex-1 flex items-center gap-4 flex-wrap">
					<span className="text-xl font-medium px-2">kwartrack</span>
					<nav className="hidden sm:flex flex-wrap gap-1">
						{NAV.map((n) => (
							<NavLink
								key={n.to}
								to={n.to}
								end={n.to === "/"}
								className={({ isActive }) =>
									`relative px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer select-none ` +
									(isActive
										? "text-base-content font-medium"
										: "text-base-content/60 hover:text-base-content hover:bg-base-content/5")
								}
							>
								{({ isActive }) => (
									<>
										<span className="relative">
											{n.label}
											{n.indicator && showIndicator(n.indicator) && (
												<>
													<span
														className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-error"
														aria-hidden="true"
													/>
													<span className="sr-only">{indicatorLabel[n.indicator]}</span>
												</>
											)}
										</span>
										{isActive && (
											<span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
										)}
									</>
								)}
							</NavLink>
						))}
					</nav>
				</div>

				<div className="flex-none">
					<div className="dropdown dropdown-end">
						<button type="button" tabIndex={0} className="avatar avatar-placeholder cursor-pointer">
							<div className="bg-primary text-primary-content w-9 rounded-full">
								<span className="text-sm">{initialsFrom(displayName)}</span>
							</div>
						</button>
						<ul
							tabIndex={0}
							className="dropdown-content menu bg-base-100 rounded-box shadow-md z-50 w-52 p-2 mt-2"
						>
							<li className="menu-title text-xs font-normal text-base-content/60 px-3 py-1">
								{displayName}
							</li>
							<li className="divider my-1" />
							<li>
								<span className="text-xs font-medium text-base-content/50 uppercase tracking-wide px-3 py-1 cursor-default pointer-events-none">
									Theme
								</span>
							</li>
							{(["system", "light", "dark"] as const).map((t) => (
								<li key={t}>
									<button
										type="button"
										className={`justify-between ${theme === t ? "active" : ""}`}
										onClick={() => setTheme(t)}
									>
										<span className="capitalize">{t}</span>
										{theme === t && <span className="text-xs opacity-60">✓</span>}
									</button>
								</li>
							))}
							<li className="divider my-1" />
							<li>
								<NavLink to="/settings/tags">Settings</NavLink>
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
