import { Handshake, Home, PieChart, Repeat2, Wallet } from "lucide-react";
import { type ComponentType, type SVGProps, useEffect, useState } from "react";
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

/**
 * Reports which panel is currently most visible in the viewport so the dock
 * can highlight it. Falls back to the first panel until IntersectionObserver
 * fires (mount, jsdom). Threshold cluster reports as elements move through
 * the viewport — we pick the one with the largest intersection ratio.
 */
function useActivePanel(): string {
	const [active, setActive] = useState<string>(ITEMS[0].panelId);
	useEffect(() => {
		const elements = ITEMS.map((i) => document.getElementById(i.panelId)).filter(
			(el): el is HTMLElement => el != null,
		);
		if (elements.length === 0) return;

		const ratios = new Map<string, number>();
		const obs = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					ratios.set(e.target.id, e.intersectionRatio);
				}
				let best = ITEMS[0].panelId;
				let bestRatio = -1;
				for (const [id, ratio] of ratios) {
					if (ratio > bestRatio) {
						bestRatio = ratio;
						best = id;
					}
				}
				setActive(best);
			},
			{ threshold: [0.1, 0.25, 0.5, 0.75, 1] },
		);
		for (const el of elements) obs.observe(el);
		return () => obs.disconnect();
	}, []);
	return active;
}

export function MobileDock() {
	const hasBudgetOverage = useBudgetOverage();
	const { hasUnsettledLoaned } = useDebtsAndSplits();
	const activePanelId = useActivePanel();

	function showIndicator(kind: Indicator | undefined): boolean {
		if (kind === "budget") return hasBudgetOverage;
		if (kind === "loaned") return hasUnsettledLoaned;
		return false;
	}

	return (
		<div className="dock dock-sm sm:hidden bg-base-100 border-t border-base-300">
			{ITEMS.map((item) => {
				const isActive = item.panelId === activePanelId;
				return (
					<button
						key={item.panelId}
						type="button"
						onClick={() => scrollToPanel(item.panelId)}
						className={isActive ? "dock-active text-primary" : undefined}
						aria-current={isActive ? "page" : undefined}
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
					</button>
				);
			})}
		</div>
	);
}
