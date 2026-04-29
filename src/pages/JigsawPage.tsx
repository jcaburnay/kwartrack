import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { AccountsDrawer } from "../components/drawers/AccountsDrawer";
import { BudgetDrawer } from "../components/drawers/BudgetDrawer";
import { DebtsDrawer } from "../components/drawers/DebtsDrawer";
import { RecurringDrawer } from "../components/drawers/RecurringDrawer";
import { Header } from "../components/Header";
import { AccountsPanel } from "../components/panels/AccountsPanel";
import { BudgetPanel } from "../components/panels/BudgetPanel";
import { DebtsPanel } from "../components/panels/DebtsPanel";
import { NetWorthPanel } from "../components/panels/NetWorthPanel";
import { RecurringPanel } from "../components/panels/RecurringPanel";

type DrawerName = "accounts" | "budget" | "recurring" | "debts";

const MODAL_TO_DRAWER: Record<string, DrawerName> = {
	"new-transaction": "accounts",
	"new-account": "accounts",
	"new-recurring": "recurring",
	"new-split": "debts",
	"new-debt": "debts",
};

export function JigsawPage() {
	const [activeDrawer, setActiveDrawer] = useState<DrawerName | null>(null);
	const [drawerModal, setDrawerModal] = useState<string | null>(null);
	const [params, setParams] = useSearchParams();

	useEffect(() => {
		const modal = params.get("modal");
		const focus = params.get("focus") as DrawerName | null;

		if (modal && MODAL_TO_DRAWER[modal]) {
			setActiveDrawer(MODAL_TO_DRAWER[modal]);
			setDrawerModal(modal);
		} else if (focus && ["accounts", "budget", "recurring", "debts"].includes(focus)) {
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

			<div className="drawer-content min-h-dvh bg-base-200 flex flex-col">
				<Header />
				<main className="flex-1 p-4 pb-20 sm:p-6">
					{/* Bento grid — 6-column base, mobile stacks */}
					<div
						className="grid grid-cols-1 sm:grid-cols-6 gap-4"
						style={{ gridTemplateRows: "repeat(3, minmax(260px, auto))" }}
					>
						<div id="panel-accounts" className="sm:col-span-4 sm:row-span-2">
							<AccountsPanel onSeeAll={() => openDrawer("accounts")} />
						</div>
						<div id="panel-budget" className="sm:col-span-2">
							<BudgetPanel onSeeAll={() => openDrawer("budget")} />
						</div>
						<div id="panel-recurring" className="sm:col-span-2">
							<RecurringPanel onSeeAll={() => openDrawer("recurring")} />
						</div>
						<div id="panel-debts" className="sm:col-span-2">
							<DebtsPanel onSeeAll={() => openDrawer("debts")} />
						</div>
						<div id="panel-networth" className="sm:col-span-4">
							<NetWorthPanel />
						</div>
					</div>
				</main>
			</div>

			<div className="drawer-side z-50">
				<label htmlFor="jigsaw-drawer" aria-label="Close drawer" className="drawer-overlay" />
				<div className="bg-base-100 min-h-full w-full sm:w-[700px] flex flex-col shadow-xl">
					{activeDrawer === "accounts" && (
						<AccountsDrawer pendingModal={drawerModal} onClose={closeDrawer} />
					)}
					{activeDrawer === "budget" && (
						<BudgetDrawer pendingModal={drawerModal} onClose={closeDrawer} />
					)}
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
