import { Handshake, Home, PieChart, Repeat2, Wallet } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router";
import { useBudgetOverage } from "../hooks/useBudgetOverage";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type Indicator = "budget" | "loaned";

const ITEMS: { to: string; label: string; Icon: IconType; end?: boolean; indicator?: Indicator }[] =
	[
		{ to: "/", label: "Overview", Icon: Home, end: true },
		{ to: "/accounts", label: "Accounts", Icon: Wallet },
		{ to: "/budget", label: "Budget", Icon: PieChart, indicator: "budget" },
		{ to: "/recurring", label: "Recurring", Icon: Repeat2 },
		{ to: "/debts-and-splits", label: "Debts", Icon: Handshake, indicator: "loaned" },
	];

const INDICATOR_LABEL: Record<Indicator, string> = {
	budget: "(over budget)",
	loaned: "(unsettled debts)",
};

export function MobileDock() {
	const hasBudgetOverage = useBudgetOverage();
	const { hasUnsettledLoaned } = useDebtsAndSplits();

	function showIndicator(kind: Indicator | undefined): boolean {
		if (kind === "budget") return hasBudgetOverage;
		if (kind === "loaned") return hasUnsettledLoaned;
		return false;
	}

	return (
		<div className="dock dock-sm sm:hidden bg-base-100 border-t border-base-300">
			{ITEMS.map((item) => (
				<NavLink
					key={item.to}
					to={item.to}
					end={item.end}
					className={({ isActive }) => (isActive ? "dock-active" : "")}
				>
					<span className="relative">
						<item.Icon className="size-5" aria-hidden="true" />
						{showIndicator(item.indicator) && (
							<>
								<span
									className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-error"
									aria-hidden="true"
								/>
								<span className="sr-only">{INDICATOR_LABEL[item.indicator!]}</span>
							</>
						)}
					</span>
					<span className="dock-label">{item.label}</span>
				</NavLink>
			))}
		</div>
	);
}
