import { useClerk, useUser } from "@clerk/react";
import {
	ArrowLeftRight,
	Building2,
	CalendarClock,
	HandCoins,
	LayoutDashboard,
	LogOut,
	PanelLeft,
	PiggyBank,
	Settings,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

export const NAV_ITEMS = [
	{ label: "Overview", icon: LayoutDashboard, to: "/overview" },
	{ label: "Accounts", icon: Building2, to: "/accounts" },
	{ label: "Transactions", icon: ArrowLeftRight, to: "/transactions" },
	{ label: "Recurring", icon: CalendarClock, to: "/recurring" },
	{ label: "Budget", icon: PiggyBank, to: "/budget" },
	{ label: "Debts & Splits", icon: HandCoins, to: "/debts" },
];

const IMPLEMENTED_ROUTES = new Set([
	"/overview",
	"/accounts",
	"/transactions",
	"/recurring",
	"/budget",
	"/debts",
	"/settings",
]);

export function Sidebar() {
	const { pathname } = useLocation();
	const { user } = useUser();
	const { openUserProfile, signOut } = useClerk();

	return (
		<div className="flex min-h-full flex-col items-start bg-base-200 border-r border-base-300 is-drawer-close:w-14 is-drawer-open:w-64">
			{/* Header: brand + toggle */}
			<div className="flex w-full items-center gap-3 px-3 py-4 border-b border-base-300">
				<span className="text-xl font-semibold tracking-tight is-drawer-close:hidden flex-1 min-w-0 truncate">
					Kwartrack
				</span>
				<label
					htmlFor="main-drawer"
					aria-label="toggle sidebar"
					className="btn btn-ghost btn-sm btn-square shrink-0 cursor-pointer"
				>
					<PanelLeft size={18} />
				</label>
			</div>

			{/* Nav */}
			<nav className="w-full flex-1 px-2 py-3">
				<ul className="menu w-full p-0 gap-0.5">
					{NAV_ITEMS.map(({ label, icon: Icon, to }) => {
						const isImplemented = IMPLEMENTED_ROUTES.has(to);

						if (!isImplemented) {
							return (
								<li key={label}>
									<span
										className="is-drawer-close:tooltip is-drawer-close:tooltip-right opacity-30 cursor-not-allowed"
										data-tip={label}
										title="Coming soon"
									>
										<Icon size={18} strokeWidth={1.8} className="my-1.5" />
										<span className="is-drawer-close:hidden whitespace-nowrap">{label}</span>
									</span>
								</li>
							);
						}

						return (
							<li key={label}>
								<NavLink
									to={to}
									end
									className={({ isActive }) =>
										`is-drawer-close:tooltip is-drawer-close:tooltip-right ${isActive ? "active bg-primary/10 text-primary font-medium" : ""}`
									}
									data-tip={label}
								>
									<Icon
										size={18}
										strokeWidth={pathname.startsWith(to) ? 2.2 : 1.8}
										className="my-1.5"
									/>
									<span className="is-drawer-close:hidden whitespace-nowrap">{label}</span>
								</NavLink>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* Bottom: user + settings + theme */}
			<div className="w-full px-2 py-3 border-t border-base-300">
				<ul className="menu w-full p-0 gap-0.5">
					{/* User profile */}
					<li>
						<button
							type="button"
							onClick={() => openUserProfile()}
							className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
							data-tip={user?.fullName ?? "Account"}
						>
							<div className="my-1.5 size-[18px] rounded-full shrink-0 overflow-hidden bg-base-300">
								{user?.imageUrl && (
									<img
										src={user.imageUrl}
										alt={user.fullName ?? "User"}
										className="size-full block"
									/>
								)}
							</div>
							<span className="is-drawer-close:hidden whitespace-nowrap">
								{user?.fullName ?? "Account"}
							</span>
						</button>
					</li>

					{/* Settings */}
					<li>
						<NavLink
							to="/settings"
							end
							className={({ isActive }) =>
								`is-drawer-close:tooltip is-drawer-close:tooltip-right ${isActive ? "active" : ""}`
							}
							data-tip="Settings"
						>
							<Settings
								size={18}
								strokeWidth={pathname.startsWith("/settings") ? 2.2 : 1.8}
								className="my-1.5"
							/>
							<span className="is-drawer-close:hidden whitespace-nowrap">Settings</span>
						</NavLink>
					</li>

					{/* Sign out */}
					<li>
						<button
							type="button"
							onClick={() => signOut()}
							className="is-drawer-close:tooltip is-drawer-close:tooltip-right text-error/70 hover:text-error hover:bg-error/10"
							data-tip="Sign out"
						>
							<LogOut size={18} className="my-1.5" />
							<span className="is-drawer-close:hidden whitespace-nowrap">Sign out</span>
						</button>
					</li>

					{/* Theme toggle */}
					<li>
						<ThemeToggle />
					</li>
				</ul>
			</div>
		</div>
	);
}
