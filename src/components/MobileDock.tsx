import { Handshake, Home, PieChart, Repeat2, Wallet } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useBudgetOverage } from "../hooks/useBudgetOverage";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type Indicator = "budget" | "loaned";

const ITEMS: { panelId: string; label: string; Icon: IconType; indicator?: Indicator }[] = [
	{ panelId: "panel-networth", label: "Overview", Icon: Home },
	{ panelId: "panel-accounts", label: "Accounts", Icon: Wallet },
	{ panelId: "panel-recurring", label: "Recurring", Icon: Repeat2 },
	{ panelId: "panel-budget", label: "Budget", Icon: PieChart, indicator: "budget" },
	{ panelId: "panel-debts", label: "Debts", Icon: Handshake, indicator: "loaned" },
];

const INDICATOR_LABEL: Record<Indicator, string> = {
	budget: "(over budget)",
	loaned: "(unsettled debts)",
};

function scrollToPanel(id: string) {
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
				<button key={item.panelId} type="button" onClick={() => scrollToPanel(item.panelId)}>
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
				</button>
			))}
		</div>
	);
}
