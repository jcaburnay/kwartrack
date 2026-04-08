import {
	ArrowLeftRight,
	Building2,
	CalendarClock,
	HandCoins,
	LayoutDashboard,
	Menu,
	PiggyBank,
	Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

const TABS = [
	{ label: "Overview", icon: LayoutDashboard, to: "/overview" },
	{ label: "Transactions", icon: ArrowLeftRight, to: "/transactions" },
	{ label: "Accounts", icon: Building2, to: "/accounts" },
	{ label: "Budget", icon: PiggyBank, to: "/budget" },
	{ label: "More", icon: Menu, to: null },
] as const;

const MORE_ITEMS = [
	{ label: "Recurring", icon: CalendarClock, to: "/recurring" },
	{ label: "Debts & Splits", icon: HandCoins, to: "/debts" },
	{ label: "Settings", icon: Settings, to: "/settings" },
];

export function BottomTabBar() {
	const { pathname } = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);
	const moreRef = useRef<HTMLDivElement>(null);

	const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.to));

	useEffect(() => {
		if (!moreOpen) return;

		function handleClickOutside(e: MouseEvent) {
			if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
				setMoreOpen(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [moreOpen]);

	return (
		<div className="dock md:hidden z-50">
			{TABS.map((tab) => {
				const Icon = tab.icon;

				if (tab.to === null) {
					const active = isMoreActive;
					return (
						<div key={tab.label} className="relative" ref={moreRef}>
							<button
								type="button"
								onClick={() => setMoreOpen((prev) => !prev)}
								className={active ? "dock-active" : ""}
							>
								<Icon size={20} />
								<span className="dock-label">{tab.label}</span>
							</button>

							{moreOpen && (
								<div className="absolute bottom-full mb-2 right-0 bg-base-100 border border-base-300/50 rounded-xl shadow-lg p-2 min-w-[196px]">
									{MORE_ITEMS.map((item) => {
										const ItemIcon = item.icon;
										const itemActive = pathname.startsWith(item.to);
										return (
											<Link
												key={item.label}
												to={item.to}
												onClick={() => setMoreOpen(false)}
												className={`flex items-center gap-3 px-4 py-2 min-h-[44px] hover:bg-base-200 rounded-lg ${
													itemActive ? "text-primary" : ""
												}`}
											>
												<ItemIcon size={18} />
												<span className="text-sm whitespace-nowrap">{item.label}</span>
											</Link>
										);
									})}
								</div>
							)}
						</div>
					);
				}

				const active = pathname.startsWith(tab.to);
				return (
					<Link key={tab.label} to={tab.to} className={active ? "dock-active" : ""}>
						<Icon size={20} />
						<span className="dock-label">{tab.label}</span>
					</Link>
				);
			})}
		</div>
	);
}
