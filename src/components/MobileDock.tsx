import { Handshake, Home, PieChart, Repeat2, Wallet } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useBudgetOverage } from "../hooks/useBudgetOverage";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type Indicator = "budget" | "loaned";
type PanelId = "networth" | "accounts" | "recurring" | "budget" | "debts";

const ITEMS: { panelId: PanelId; label: string; Icon: IconType; indicator?: Indicator }[] = [
	{ panelId: "networth", label: "Overview", Icon: Home },
	{ panelId: "accounts", label: "Accounts", Icon: Wallet },
	{ panelId: "recurring", label: "Recurring", Icon: Repeat2 },
	{ panelId: "budget", label: "Budget", Icon: PieChart, indicator: "budget" },
	{ panelId: "debts", label: "Debts", Icon: Handshake, indicator: "loaned" },
];

const INDICATOR_LABEL: Record<Indicator, string> = {
	budget: "(over budget)",
	loaned: "(unsettled debts)",
};

export function MobileDock() {
	const hasBudgetOverage = useBudgetOverage();
	const { hasUnsettledLoaned } = useDebtsAndSplits();
	const [params, setParams] = useSearchParams();
	const navigate = useNavigate();
	const location = useLocation();

	const activePanel = (params.get("panel") ?? "networth") as PanelId;
	const onHome = location.pathname === "/";

	function activate(panel: PanelId) {
		if (onHome) {
			const next = new URLSearchParams(params);
			next.set("panel", panel);
			// In-page tab switch — replace so we don't pile up history entries.
			setParams(next, { replace: true });
		} else {
			// Cross-page jump (e.g. from /settings) — push so back returns to the
			// page the user came from.
			navigate(`/?panel=${panel}`);
		}
	}

	function showIndicator(kind: Indicator | undefined): boolean {
		if (kind === "budget") return hasBudgetOverage;
		if (kind === "loaned") return hasUnsettledLoaned;
		return false;
	}

	return (
		<div className="dock dock-sm lg:hidden bg-base-100 border-t border-base-300">
			{ITEMS.map((item) => {
				const isActive = onHome && item.panelId === activePanel;
				return (
					<button
						key={item.panelId}
						type="button"
						onClick={() => activate(item.panelId)}
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
