import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { DateRangeValue } from "../transactions/DateRangePicker";
import { EditTransactionModal } from "../transactions/EditTransactionModal";
import { NewTransactionModal } from "../transactions/NewTransactionModal";
import { TransactionFilterBar } from "../transactions/TransactionFilterBar";
import type { TransactionFormValues } from "../transactions/TransactionForm";
import { TransactionsTable } from "../transactions/TransactionsTable";

type Props = {
	pendingModal: string | null;
	onClose: () => void;
};

export function AccountsDrawer({ pendingModal, onClose }: Props) {
	const { profile } = useAuth();
	const { accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
	const { groups, refetch: refetchGroups } = useAccountGroups();
	const { transactions, refetch: refetchTransactions } = useTransactions();
	const { tags, createInline } = useTags();
	const { recurrings } = useRecurrings();
	const { selection, selectAccount, selectGroup, clear } = useSelectedAccount(accounts, groups);

	const [showNewAccount, setShowNewAccount] = useState(false);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [showArchived, setShowArchived] = useState(false);
	const [showNewTx, setShowNewTx] = useState(false);
	const [newTxPrefill, setNewTxPrefill] = useState<Partial<TransactionFormValues>>({});
	const [editingTx, setEditingTx] = useState<Transaction | null>(null);
	const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);

	const selectionRef = useRef(selection);
	selectionRef.current = selection;

	useEffect(() => {
		if (pendingModal === "new-transaction") {
			const sel = selectionRef.current;
			setNewTxPrefill(
				sel.kind === "account" ? { type: "expense", fromAccountId: sel.account.id } : {},
			);
			setShowNewTx(true);
		} else if (pendingModal === "new-account") {
			setShowNewAccount(true);
		}
	}, [pendingModal]);

	const net = useMemo(() => computeNetWorth(accounts), [accounts]);
	const timezone = profile?.timezone ?? "Asia/Manila";

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

	const [dateRange, setDateRange] = useState<DateRangeValue>({
		preset: "all-time",
		customFrom: null,
		customTo: null,
	});
	const [search, setSearch] = useState("");

	const handleSetFilters = useCallback((next: TransactionFilters) => setFilters(next), []);
	const handleSetDateRange = useCallback((next: DateRangeValue) => setDateRange(next), []);
	const handleSetSearch = useCallback((next: string) => setSearch(next), []);

	async function onTxChanged() {
		await Promise.all([refetchTransactions(), refetchAccounts()]);
	}

	function openNewTransaction(prefill: Partial<TransactionFormValues>) {
		setNewTxPrefill(prefill);
		setShowNewTx(true);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between p-4 border-b border-base-200">
				<h2 className="text-lg font-semibold">Accounts</h2>
				<button
					type="button"
					aria-label="Close accounts drawer"
					className="btn btn-ghost btn-sm btn-circle"
					onClick={onClose}
				>
					<X className="size-4" />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
				<div className="flex items-end justify-between gap-4 flex-wrap">
					<p className="text-sm text-base-content/60">
						Assets{" "}
						<strong className="text-base-content">{formatCentavos(net.assetsCentavos)}</strong>
						{" · "}
						Net Worth{" "}
						<strong className={net.netWorthCentavos < 0 ? "text-error" : "text-base-content"}>
							{formatCentavos(net.netWorthCentavos)}
						</strong>
					</p>
					<label className="label cursor-pointer justify-start gap-2 py-0">
						<input
							type="checkbox"
							checked={showArchived}
							onChange={(e) => setShowArchived(e.target.checked)}
							className="toggle toggle-sm"
						/>
						<span className="label-text">Show archived</span>
					</label>
				</div>

				{accountsLoading ? (
					<div className="flex justify-center py-8">
						<span className="loading loading-spinner loading-lg text-primary" />
					</div>
				) : (
					<>
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

						{accounts.length > 0 && (
							<section className="flex flex-col gap-2">
								<div className="flex items-center justify-between gap-2 flex-wrap">
									<h2 className="text-lg font-semibold">Transactions</h2>
									<button
										type="button"
										className="btn btn-primary btn-sm"
										onClick={() => openNewTransaction({})}
									>
										New Transaction
									</button>
								</div>
								<TransactionFilterBar
									filters={filters}
									dateRange={dateRange}
									search={search}
									onChange={handleSetFilters}
									onDateRangeChange={handleSetDateRange}
									onSearchChange={handleSetSearch}
									accounts={accounts}
									groups={groups}
									tags={tags}
								/>
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
							</section>
						)}
					</>
				)}
			</div>

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
