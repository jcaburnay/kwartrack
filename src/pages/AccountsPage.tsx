import { useState } from "react";
import { AccountsTable } from "../components/accounts/AccountsTable";
import { EditAccountModal } from "../components/accounts/EditAccountModal";
import { NewAccountModal } from "../components/accounts/NewAccountModal";
import { Fab } from "../components/Fab";
import { Header } from "../components/Header";
import { AccountDetailStrip } from "../components/strips/AccountDetailStrip";
import { useAccountGroups } from "../hooks/useAccountGroups";
import { useAccounts } from "../hooks/useAccounts";
import { useSelectedAccount } from "../hooks/useSelectedAccount";
import type { Account } from "../utils/accountBalances";
import { computeNetWorth } from "../utils/accountBalances";
import { formatCentavos } from "../utils/currency";

export function AccountsPage() {
	const { accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
	const { groups, refetch: refetchGroups } = useAccountGroups();
	const { selection, selectAccount, selectGroup, clear } = useSelectedAccount(accounts, groups);

	const [fabOpen, setFabOpen] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [editing, setEditing] = useState<Account | null>(null);
	const [showArchived, setShowArchived] = useState(false);

	const net = computeNetWorth(accounts);

	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto flex flex-col gap-5">
				<section className="flex items-end justify-between gap-4 flex-wrap">
					<div>
						<h1 className="text-2xl font-semibold">Accounts</h1>
						<p className="text-sm text-base-content/60">
							Assets{" "}
							<strong className="text-base-content">{formatCentavos(net.assetsCentavos)}</strong>
							{" · "}
							Liabilities{" "}
							<strong className="text-base-content">
								{formatCentavos(net.liabilitiesCentavos)}
							</strong>
							{" · "}
							Net Worth{" "}
							<strong className={net.netWorthCentavos < 0 ? "text-error" : "text-base-content"}>
								{formatCentavos(net.netWorthCentavos)}
							</strong>
						</p>
					</div>
					<label className="label cursor-pointer justify-start gap-2 py-0">
						<input
							type="checkbox"
							className="toggle toggle-sm"
							checked={showArchived}
							onChange={(e) => setShowArchived(e.target.checked)}
						/>
						<span className="label-text">Show archived</span>
					</label>
				</section>

				{accountsLoading ? (
					<div className="flex justify-center py-8">
						<span className="loading loading-spinner loading-lg text-primary" />
					</div>
				) : (
					<AccountsTable
						accounts={accounts}
						groups={groups}
						selectedAccountId={selection.kind === "account" ? selection.account.id : null}
						selectedGroupId={selection.kind === "group" ? selection.group.id : null}
						onSelectAccount={selectAccount}
						onSelectGroup={selectGroup}
						onEdit={(a) => setEditing(a)}
						onChanged={() => refetchAccounts()}
						showArchived={showArchived}
					/>
				)}

				{selection.kind === "account" && (
					<AccountDetailStrip account={selection.account} onClear={clear} />
				)}
				{selection.kind === "group" && (
					<div className="text-sm text-base-content/60 italic">
						Group selected: transactions filter arrives with the next slice.
					</div>
				)}
			</main>

			<Fab
				isOpen={fabOpen}
				onToggle={() => setFabOpen((v) => !v)}
				onDismiss={() => setFabOpen(false)}
				actions={[
					{
						label: "New Account",
						description: "Cash, e-wallet, savings, credit, or time deposit.",
						onClick: () => setShowNew(true),
					},
				]}
			/>

			{showNew && (
				<NewAccountModal
					groups={groups}
					onRefetchGroups={refetchGroups}
					onSaved={async () => {
						setShowNew(false);
						await refetchAccounts();
					}}
					onCancel={() => setShowNew(false)}
				/>
			)}

			{editing && (
				<EditAccountModal
					account={editing}
					groups={groups}
					onRefetchGroups={refetchGroups}
					onSaved={async () => {
						setEditing(null);
						await refetchAccounts();
					}}
					onCancel={() => setEditing(null)}
				/>
			)}
		</div>
	);
}
