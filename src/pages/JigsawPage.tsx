import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { AccountsPanel, type CrossSplitFilter } from "../components/panels/AccountsPanel";
import { BudgetPanel } from "../components/panels/BudgetPanel";
import { DebtsPanel, type DebtsPending } from "../components/panels/DebtsPanel";
import { NetWorthPanel } from "../components/panels/NetWorthPanel";
import { RecurringPanel, type RecurringPending } from "../components/panels/RecurringPanel";

type AccountsPendingModal = "new-transaction" | "new-account" | null;

const ACCOUNTS_DEEP_LINK_MODALS: ReadonlySet<string> = new Set(["new-transaction", "new-account"]);

const RECURRING_DEEP_LINK_MODALS: ReadonlySet<string> = new Set([
	"new-recurring",
	"edit-recurring",
]);

const DEBTS_DEEP_LINK_MODALS: ReadonlySet<string> = new Set(["new-debt", "new-split"]);

const PANEL_IDS = ["networth", "accounts", "recurring", "budget", "debts"] as const;
export type PanelId = (typeof PANEL_IDS)[number];

function isPanelId(value: string | null): value is PanelId {
	return value != null && (PANEL_IDS as readonly string[]).includes(value);
}

export function JigsawPage() {
	const [accountsPending, setAccountsPending] = useState<AccountsPendingModal>(null);
	const [recurringPending, setRecurringPending] = useState<RecurringPending>(null);
	const [debtsPending, setDebtsPending] = useState<DebtsPending>(null);
	const [crossSplitFilter, setCrossSplitFilter] = useState<CrossSplitFilter>(null);
	const [params, setParams] = useSearchParams();

	const rawPanel = params.get("panel");
	const activePanel: PanelId = isPanelId(rawPanel) ? rawPanel : "networth";

	useEffect(() => {
		const modal = params.get("modal");
		const focus = params.get("focus");

		let nextActivePanel: PanelId | null = null;

		if (modal && ACCOUNTS_DEEP_LINK_MODALS.has(modal)) {
			setAccountsPending(modal as AccountsPendingModal);
			nextActivePanel = "accounts";
		} else if (modal && RECURRING_DEEP_LINK_MODALS.has(modal)) {
			if (modal === "new-recurring") {
				setRecurringPending({ kind: "new" });
			} else {
				const id = params.get("id");
				if (id) setRecurringPending({ kind: "edit", id });
			}
			nextActivePanel = "recurring";
		} else if (modal && DEBTS_DEEP_LINK_MODALS.has(modal)) {
			setDebtsPending(modal as DebtsPending);
			nextActivePanel = "debts";
		} else if (focus && isPanelId(focus)) {
			nextActivePanel = focus;
		}

		if (modal || focus) {
			const next = new URLSearchParams(params);
			next.delete("modal");
			next.delete("focus");
			next.delete("id");
			if (nextActivePanel) next.set("panel", nextActivePanel);
			setParams(next, { replace: true });
		}
	}, [params, setParams]);

	function panelClass(name: PanelId, baseClass: string) {
		const isActive = activePanel === name;
		// On mobile + tablet (<lg) only the active panel is visible — the dock
		// drives navigation. From lg up, the jigsaw grid lays them all out.
		const visibility = isActive ? "" : "hidden lg:block";
		return `${baseClass} flex-1 min-h-0 lg:flex-none ${visibility}`.trim();
	}

	return (
		<div className="h-dvh bg-base-200 flex flex-col overflow-hidden">
			<Header />
			<main className="flex-1 px-2 sm:px-3 pt-2 sm:pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-3 overflow-hidden">
				<div className="jigsaw-grid flex flex-col gap-2 h-full">
					<div id="panel-networth" className={panelClass("networth", "jigsaw-networth")}>
						<NetWorthPanel />
					</div>
					<div id="panel-accounts" className={panelClass("accounts", "jigsaw-txns")}>
						<AccountsPanel
							pendingModal={accountsPending}
							onPendingModalConsumed={() => setAccountsPending(null)}
							crossSplitFilter={crossSplitFilter}
							onClearCrossSplitFilter={() => setCrossSplitFilter(null)}
						/>
					</div>
					<div id="panel-recurring" className={panelClass("recurring", "jigsaw-recurring")}>
						<RecurringPanel
							pendingModal={recurringPending}
							onPendingModalConsumed={() => setRecurringPending(null)}
						/>
					</div>
					<div id="panel-budget" className={panelClass("budget", "jigsaw-budget")}>
						<BudgetPanel />
					</div>
					<div id="panel-debts" className={panelClass("debts", "jigsaw-debts")}>
						<DebtsPanel
							pendingModal={debtsPending}
							onPendingModalConsumed={() => setDebtsPending(null)}
							onCrossFilterSplit={(filter) => {
								setCrossSplitFilter(filter);
								// Cross-filtering jumps to the accounts panel so the user sees the
								// filtered transactions immediately.
								const next = new URLSearchParams(params);
								next.set("panel", "accounts");
								setParams(next, { replace: true });
							}}
						/>
					</div>
				</div>
			</main>
		</div>
	);
}
