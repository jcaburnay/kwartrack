import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { DebtsDrawer } from "../components/drawers/DebtsDrawer";
import { RecurringDrawer } from "../components/drawers/RecurringDrawer";
import { Header } from "../components/Header";
import { AccountsPanel } from "../components/panels/AccountsPanel";
import { BudgetPanel } from "../components/panels/BudgetPanel";
import { DebtsPanel } from "../components/panels/DebtsPanel";
import { NetWorthPanel } from "../components/panels/NetWorthPanel";
import { RecurringPanel } from "../components/panels/RecurringPanel";

type DrawerName = "recurring" | "debts";

const MODAL_TO_DRAWER: Record<string, DrawerName> = {
	"new-recurring": "recurring",
	"new-split": "debts",
	"new-debt": "debts",
};

type AccountsPendingModal = "new-transaction" | "new-account" | null;

const ACCOUNTS_DEEP_LINK_MODALS: ReadonlySet<string> = new Set(["new-transaction", "new-account"]);

export function JigsawPage() {
	const [activeDrawer, setActiveDrawer] = useState<DrawerName | null>(null);
	const [drawerModal, setDrawerModal] = useState<string | null>(null);
	const [accountsPending, setAccountsPending] = useState<AccountsPendingModal>(null);
	const [params, setParams] = useSearchParams();

	useEffect(() => {
		const modal = params.get("modal");
		const focus = params.get("focus");

		if (modal && ACCOUNTS_DEEP_LINK_MODALS.has(modal)) {
			setAccountsPending(modal as AccountsPendingModal);
			document.getElementById("panel-accounts")?.scrollIntoView({ behavior: "smooth" });
		} else if (modal && MODAL_TO_DRAWER[modal]) {
			setActiveDrawer(MODAL_TO_DRAWER[modal]);
			setDrawerModal(modal);
		} else if (focus && ["accounts", "recurring", "debts"].includes(focus)) {
			const el = document.getElementById(`panel-${focus}`);
			el?.scrollIntoView({ behavior: "smooth" });
		}

		if (modal || focus) {
			const next = new URLSearchParams(params);
			next.delete("modal");
			next.delete("focus");
			setParams(next, { replace: true });
		}
	}, [params, setParams]);

	function openDrawer(name: DrawerName, modal?: string) {
		setActiveDrawer(name);
		setDrawerModal(modal ?? null);
	}

	function closeDrawer() {
		setActiveDrawer(null);
		setDrawerModal(null);
	}

	return (
		<div className="drawer drawer-end">
			<input
				id="jigsaw-drawer"
				type="checkbox"
				className="drawer-toggle"
				checked={activeDrawer !== null}
				onChange={closeDrawer}
				readOnly
			/>

			<div className="drawer-content min-h-dvh sm:h-dvh bg-base-200 flex flex-col sm:overflow-hidden">
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
							<RecurringPanel />
						</div>
						<div id="panel-budget" className="jigsaw-budget">
							<BudgetPanel />
						</div>
						<div id="panel-debts" className="jigsaw-debts">
							<DebtsPanel onSeeAll={() => openDrawer("debts")} />
						</div>
					</div>
				</main>
			</div>

			<div className="drawer-side z-50">
				<label htmlFor="jigsaw-drawer" aria-label="Close drawer" className="drawer-overlay" />
				<div className="bg-base-100 min-h-full w-full sm:w-[700px] flex flex-col shadow-xl">
					{activeDrawer === "recurring" && (
						<RecurringDrawer pendingModal={drawerModal} onClose={closeDrawer} />
					)}
					{activeDrawer === "debts" && (
						<DebtsDrawer pendingModal={drawerModal} onClose={closeDrawer} />
					)}
				</div>
			</div>
		</div>
	);
}
