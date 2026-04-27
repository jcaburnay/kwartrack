import { NavLink } from "react-router";
import { useBudgetOverage } from "../hooks/useBudgetOverage";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";
import { useAuth } from "../providers/AuthProvider";

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
	{ to: "/settings/groups", label: "Settings" },
];

export function Header() {
	const { profile, signOut } = useAuth();
	const { hasUnsettledLoaned } = useDebtsAndSplits();
	const hasBudgetOverage = useBudgetOverage();
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
		<header className="navbar bg-base-100 border-b border-base-300 flex-wrap gap-y-2">
			<div className="flex-1 flex items-center gap-4 flex-wrap">
				<span className="text-xl font-semibold px-2">kwartrack</span>
				<nav className="flex flex-wrap gap-1">
					{NAV.map((n) => (
						<NavLink
							key={n.to}
							to={n.to}
							end={n.to === "/"}
							className={({ isActive }) => `btn btn-sm btn-ghost ${isActive ? "btn-active" : ""}`}
						>
							<span className="relative">
								{n.label}
								{n.indicator && showIndicator(n.indicator) && (
									<>
										<span
											className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-error"
											aria-hidden="true"
										/>
										<span className="sr-only">{indicatorLabel[n.indicator]}</span>
									</>
								)}
							</span>
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
