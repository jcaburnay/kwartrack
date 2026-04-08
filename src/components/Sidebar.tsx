import { UserButton } from "@clerk/react";
import {
	ArrowLeftRight,
	Building2,
	CalendarClock,
	HandCoins,
	LayoutDashboard,
	PiggyBank,
	Settings,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

export const NAV_ITEMS = [
	{ label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
	{ label: "Accounts", icon: Building2, to: "/accounts" },
	{ label: "Transactions", icon: ArrowLeftRight, to: "/transactions" },
	{ label: "Debts & Splits", icon: HandCoins, to: "/debts" },
	{ label: "Recurring", icon: CalendarClock, to: "/recurring" },
	{ label: "Budget", icon: PiggyBank, to: "/budget" },
	{ label: "Settings", icon: Settings, to: "/settings" },
];

const IMPLEMENTED_ROUTES = new Set([
	"/dashboard",
	"/accounts",
	"/transactions",
	"/recurring",
	"/budget",
	"/debts",
	"/settings",
]);

export function Sidebar() {
	const { pathname } = useLocation();

	return (
		<div className="hidden sm:flex flex-col h-full min-h-screen w-60 bg-base-200 border-r border-base-300">
			{/* Header: brand + user menu */}
			<div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-base-300">
				<span className="text-xl font-semibold tracking-tight">Kwartrack</span>
				<UserButton />
			</div>

			{/* Nav */}
			<nav className="flex-1 px-2.5 py-3">
				<ul className="flex flex-col gap-0.5">
					{NAV_ITEMS.map(({ label, icon: Icon, to }) => {
						const isActive = pathname.startsWith(to);
						const isImplemented = IMPLEMENTED_ROUTES.has(to);

						if (!isImplemented) {
							return (
								<li key={label}>
									<span
										className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium opacity-30 cursor-not-allowed"
										title="Coming soon"
									>
										<Icon size={18} strokeWidth={1.8} />
										{label}
									</span>
								</li>
							);
						}

						return (
							<li key={label}>
								<Link
									to={to}
									className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
										isActive
											? "bg-primary/10 text-primary font-semibold"
											: "text-base-content/60 hover:text-base-content hover:bg-base-300/50"
									}`}
								>
									<Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
									{label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* Footer: theme toggle */}
			<div className="px-3 py-3 border-t border-base-300">
				<ThemeToggle />
			</div>
		</div>
	);
}
