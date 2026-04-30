import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { AccountsPanel } from "../components/panels/AccountsPanel";
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

export function JigsawPage() {
	const [accountsPending, setAccountsPending] = useState<AccountsPendingModal>(null);
	const [recurringPending, setRecurringPending] = useState<RecurringPending>(null);
	const [debtsPending, setDebtsPending] = useState<DebtsPending>(null);
	const [params, setParams] = useSearchParams();

	useEffect(() => {
		const modal = params.get("modal");
		const focus = params.get("focus");

		if (modal && ACCOUNTS_DEEP_LINK_MODALS.has(modal)) {
			setAccountsPending(modal as AccountsPendingModal);
			document.getElementById("panel-accounts")?.scrollIntoView({ behavior: "smooth" });
		} else if (modal && RECURRING_DEEP_LINK_MODALS.has(modal)) {
			if (modal === "new-recurring") {
				setRecurringPending({ kind: "new" });
			} else {
				const id = params.get("id");
				if (id) setRecurringPending({ kind: "edit", id });
			}
			document.getElementById("panel-recurring")?.scrollIntoView({ behavior: "smooth" });
		} else if (modal && DEBTS_DEEP_LINK_MODALS.has(modal)) {
			setDebtsPending(modal as DebtsPending);
			document.getElementById("panel-debts")?.scrollIntoView({ behavior: "smooth" });
		} else if (focus && ["accounts", "recurring", "debts"].includes(focus)) {
			const el = document.getElementById(`panel-${focus}`);
			el?.scrollIntoView({ behavior: "smooth" });
		}

		if (modal || focus) {
			const next = new URLSearchParams(params);
			next.delete("modal");
			next.delete("focus");
			next.delete("id");
			setParams(next, { replace: true });
		}
	}, [params, setParams]);

	return (
		<div className="min-h-dvh sm:h-dvh bg-base-200 flex flex-col sm:overflow-hidden">
			<Header />
			<main className="flex-1 p-2 pb-20 sm:p-3 sm:overflow-hidden">
				{/* Jigsaw grid — named areas on desktop, stacked on mobile */}
				<div className="jigsaw-grid grid grid-cols-1 gap-2">
					<div id="panel-networth" className="jigsaw-networth">
						<NetWorthPanel />
					</div>
					<div id="panel-accounts" className="jigsaw-txns">
						<AccountsPanel
							pendingModal={accountsPending}
							onPendingModalConsumed={() => setAccountsPending(null)}
						/>
					</div>
					<div id="panel-recurring" className="jigsaw-recurring">
						<RecurringPanel
							pendingModal={recurringPending}
							onPendingModalConsumed={() => setRecurringPending(null)}
						/>
					</div>
					<div id="panel-budget" className="jigsaw-budget">
						<BudgetPanel />
					</div>
					<div id="panel-debts" className="jigsaw-debts">
						<DebtsPanel
							pendingModal={debtsPending}
							onPendingModalConsumed={() => setDebtsPending(null)}
						/>
					</div>
				</div>
			</main>
		</div>
	);
}
