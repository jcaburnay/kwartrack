import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAccountGroups } from "../../hooks/useAccountGroups";
import { useAccounts } from "../../hooks/useAccounts";
import { useRecurrings } from "../../hooks/useRecurrings";
import { useSelectedAccount } from "../../hooks/useSelectedAccount";
import { useTags } from "../../hooks/useTags";
import { useTransactions } from "../../hooks/useTransactions";
import { useAuth } from "../../providers/AuthProvider";
import type { Account } from "../../utils/accountBalances";
import { computeNetWorth } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import {
	EMPTY_FILTERS,
	matchesFilters,
	type Transaction,
	type TransactionFilters,
} from "../../utils/transactionFilters";
import { AccountsTable } from "../accounts/AccountsTable";
import { EditAccountModal } from "../accounts/EditAccountModal";
import { NewAccountModal } from "../accounts/NewAccountModal";
import { AccountDetailStrip } from "../strips/AccountDetailStrip";
import { EditTransactionModal } from "../transactions/EditTransactionModal";
import { NewTransactionModal } from "../transactions/NewTransactionModal";
import { TransactionFilterBar } from "../transactions/TransactionFilterBar";
import type { TransactionFormValues } from "../transactions/TransactionForm";
import { TransactionsTable } from "../transactions/TransactionsTable";

export function AccountsPanel() {
	const { profile } = useAuth();
	const { accounts, isLoading: aLoading, refetch: refetchAccounts } = useAccounts();
	const { groups, refetch: refetchGroups } = useAccountGroups();
	const { transactions, refetch: refetchTransactions } = useTransactions();
	const { tags, createInline } = useTags();
	const { recurrings } = useRecurrings();
	const { selection, selectAccount, selectGroup, clear } = useSelectedAccount(accounts, groups);

	const [accountsFolded, setAccountsFolded] = useState(false);
	const [txFolded, setTxFolded] = useState(false);

	const [showNewAccount, setShowNewAccount] = useState(false);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [showArchived, setShowArchived] = useState(false);
	const [showNewTx, setShowNewTx] = useState(false);
	const [newTxPrefill, setNewTxPrefill] = useState<Partial<TransactionFormValues>>({});
	const [editingTx, setEditingTx] = useState<Transaction | null>(null);
	const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);

	const timezone = profile?.timezone ?? "Asia/Manila";
	const net = useMemo(() => computeNetWorth(accounts), [accounts]);

	const accountsById = useMemo(() => {
		const m = new Map<string, { id: string; groupId: string | null }>();
		for (const a of accounts) m.set(a.id, { id: a.id, groupId: a.group_id });
		return m;
	}, [accounts]);

	const effectiveFilters: TransactionFilters = useMemo(() => {
		if (selection.kind === "account")
			return { ...filters, accountId: selection.account.id, groupId: null };
		if (selection.kind === "group")
			return { ...filters, groupId: selection.group.id, accountId: null };
		return filters;
	}, [selection, filters]);

	const filteredTransactions = useMemo(
		() => transactions.filter((t) => matchesFilters(t, effectiveFilters, accountsById)),
		[transactions, effectiveFilters, accountsById],
	);

	const handleSetFilters = useCallback((next: TransactionFilters) => setFilters(next), []);

	async function onTxChanged() {
		await Promise.all([refetchTransactions(), refetchAccounts()]);
	}

	function openNewTransaction(prefill: Partial<TransactionFormValues>) {
		setNewTxPrefill(prefill);
		setShowNewTx(true);
	}

	return (
		<div className="card bg-base-100 h-full flex flex-col overflow-hidden">
			{accountsFolded ? (
				<button
					type="button"
					aria-label="Expand accounts"
					aria-expanded="false"
					className="h-9 flex items-center gap-2 px-4 bg-base-200 border-b border-base-300 flex-shrink-0 hover:bg-base-300 transition-colors cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
					onClick={() => setAccountsFolded(false)}
				>
					<ChevronDown className="size-3.5 text-base-content/40" />
					<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
						Accounts
					</span>
					<span className="text-xs text-base-content/30">·</span>
					<span className="text-xs text-base-content/60">
						{accounts.filter((a) => !a.is_archived).length} account
						{accounts.filter((a) => !a.is_archived).length !== 1 ? "s" : ""}
					</span>
					<span className="text-xs text-base-content/30">·</span>
					<span className="text-xs tabular-nums text-base-content/70">
						Net {formatCentavos(net.netWorthCentavos)}
					</span>
				</button>
			) : (
				<>
					<div className="h-9 flex items-center justify-between px-4 flex-shrink-0 border-b border-base-300">
						<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
							Accounts
						</span>
						<div className="flex items-center gap-1.5">
							<label className="flex items-center gap-1 text-xs text-base-content/40 cursor-pointer">
								<input
									type="checkbox"
									className="checkbox checkbox-xs"
									checked={showArchived}
									onChange={(e) => setShowArchived(e.target.checked)}
								/>
								Archived
							</label>
							<button
								type="button"
								className="btn btn-primary btn-xs"
								onClick={() => setShowNewAccount(true)}
							>
								+ New
							</button>
							<button
								type="button"
								aria-label="Fold accounts"
								className="btn btn-ghost btn-xs btn-circle"
								onClick={() => setAccountsFolded(true)}
							>
								<ChevronUp className="size-3.5" />
							</button>
						</div>
					</div>
					<div className="flex-[1_1_35%] overflow-y-auto overflow-x-auto">
						{aLoading ? (
							<div className="flex justify-center py-4">
								<span className="loading loading-spinner loading-sm text-primary" />
							</div>
						) : (
							<AccountsTable
								accounts={accounts}
								groups={groups}
								recurrings={recurrings}
								selectedAccountId={selection.kind === "account" ? selection.account.id : null}
								selectedGroupId={selection.kind === "group" ? selection.group.id : null}
								onSelectAccount={selectAccount}
								onSelectGroup={selectGroup}
								onEdit={(a) => setEditingAccount(a)}
								onChanged={refetchAccounts}
								showArchived={showArchived}
							/>
						)}
					</div>
				</>
			)}

			{selection.kind === "account" && (
				<AccountDetailStrip
					account={selection.account}
					transactions={transactions}
					recurrings={recurrings}
					timezone={timezone}
					onClear={clear}
					onPayThisCard={() =>
						openNewTransaction({
							type: "transfer",
							toAccountId: selection.account.id,
							fromAccountId: null,
						})
					}
					onWithdrawMatured={() =>
						openNewTransaction({
							type: "transfer",
							fromAccountId: selection.account.id,
							toAccountId: null,
						})
					}
				/>
			)}

			{!txFolded && <div className="border-t border-base-300 flex-shrink-0" />}

			{txFolded ? (
				<button
					type="button"
					aria-label="Expand transactions"
					aria-expanded="false"
					className="h-9 flex items-center gap-2 px-4 bg-base-200 border-t border-base-300 flex-shrink-0 hover:bg-base-300 transition-colors cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
					onClick={() => setTxFolded(false)}
				>
					<ChevronDown className="size-3.5 text-base-content/40" />
					<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
						Transactions
					</span>
					<span className="text-xs text-base-content/30">·</span>
					<span className="text-xs text-base-content/60">
						{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
					</span>
				</button>
			) : (
				<div className="flex-[1_1_65%] flex flex-col overflow-hidden min-h-0">
					<div className="h-9 flex items-center justify-between px-4 flex-shrink-0 border-b border-base-300">
						<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
							Transactions
						</span>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								className="btn btn-primary btn-xs"
								onClick={() => openNewTransaction({})}
							>
								+ New
							</button>
							<button
								type="button"
								aria-label="Fold transactions"
								className="btn btn-ghost btn-xs btn-circle"
								onClick={() => setTxFolded(true)}
							>
								<ChevronUp className="size-3.5" />
							</button>
						</div>
					</div>
					<div className="flex-shrink-0">
						<TransactionFilterBar
							filters={filters}
							onChange={handleSetFilters}
							accounts={accounts}
							groups={groups}
							tags={tags}
						/>
					</div>
					<div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
						<TransactionsTable
							transactions={filteredTransactions}
							accounts={accounts}
							groups={groups}
							tags={tags}
							onEdit={(tx) => setEditingTx(tx)}
							onChanged={onTxChanged}
							emptyCopy={
								selection.kind === "account"
									? "No transactions in this account yet."
									: "No transactions yet. Use the + button to add one."
							}
						/>
					</div>
				</div>
			)}

			{showNewAccount && (
				<NewAccountModal
					groups={groups}
					onRefetchGroups={refetchGroups}
					onSaved={async () => {
						setShowNewAccount(false);
						await refetchAccounts();
					}}
					onCancel={() => setShowNewAccount(false)}
				/>
			)}
			{editingAccount && (
				<EditAccountModal
					account={editingAccount}
					groups={groups}
					onRefetchGroups={refetchGroups}
					onSaved={async () => {
						setEditingAccount(null);
						await refetchAccounts();
					}}
					onCancel={() => setEditingAccount(null)}
				/>
			)}
			{showNewTx && (
				<NewTransactionModal
					accounts={accounts}
					tags={tags}
					createTag={createInline}
					prefill={newTxPrefill}
					onSaved={async () => {
						setShowNewTx(false);
						setNewTxPrefill({});
						await onTxChanged();
					}}
					onCancel={() => {
						setShowNewTx(false);
						setNewTxPrefill({});
					}}
				/>
			)}
			{editingTx && (
				<EditTransactionModal
					transaction={editingTx}
					accounts={accounts}
					tags={tags}
					createTag={createInline}
					onSaved={async () => {
						setEditingTx(null);
						await onTxChanged();
					}}
					onCancel={() => setEditingTx(null)}
				/>
			)}
		</div>
	);
}
