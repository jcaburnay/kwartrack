import { ChevronDown, ChevronUp, X } from "lucide-react";
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
import { matchesTransactionSearch } from "../../utils/transactionSearch";
import { summariseNetFlowThisMonth } from "../../utils/transactionSummary";
import { AccountsRightPane } from "../accounts/AccountsRightPane";
import { AccountsTable } from "../accounts/AccountsTable";
import { EditAccountModal } from "../accounts/EditAccountModal";
import { NewAccountModal } from "../accounts/NewAccountModal";
import type { DateRangeValue } from "../transactions/DateRangePicker";
import { EditTransactionModal } from "../transactions/EditTransactionModal";
import { NewTransactionModal } from "../transactions/NewTransactionModal";
import { TransactionFilterBar } from "../transactions/TransactionFilterBar";
import type { TransactionFormValues } from "../transactions/TransactionForm";
import { TransactionsTable } from "../transactions/TransactionsTable";

const DEFAULT_DATE_RANGE: DateRangeValue = {
	preset: "all-time",
	customFrom: null,
	customTo: null,
};

type PendingModal = "new-transaction" | "new-account" | null;

type Props = {
	pendingModal?: PendingModal;
	onPendingModalConsumed?: () => void;
};

export function AccountsPanel({ pendingModal, onPendingModalConsumed }: Props = {}) {
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
	const [dateRange, setDateRange] = useState<DateRangeValue>(DEFAULT_DATE_RANGE);
	const [search, setSearch] = useState("");

	const timezone = profile?.timezone ?? "Asia/Manila";
	const net = useMemo(() => computeNetWorth(accounts), [accounts]);
	const netFlow = useMemo(
		() => summariseNetFlowThisMonth(transactions, timezone),
		[transactions, timezone],
	);

	const accountsById = useMemo(() => {
		const m = new Map<string, { id: string; groupId: string | null }>();
		for (const a of accounts) m.set(a.id, { id: a.id, groupId: a.group_id });
		return m;
	}, [accounts]);

	const accountNameById = useMemo(() => {
		const m = new Map<string, string>();
		for (const a of accounts) m.set(a.id, a.name);
		return m;
	}, [accounts]);

	const tagNameById = useMemo(() => {
		const m = new Map<string, string>();
		for (const t of tags) m.set(t.id, t.name);
		return m;
	}, [tags]);

	const effectiveFilters: TransactionFilters = useMemo(() => {
		if (selection.kind === "account")
			return { ...filters, accountId: selection.account.id, groupId: null };
		if (selection.kind === "group")
			return { ...filters, groupId: selection.group.id, accountId: null };
		return filters;
	}, [selection, filters]);

	const filteredTransactions = useMemo(
		() =>
			transactions.filter(
				(t) =>
					matchesFilters(t, effectiveFilters, accountsById) &&
					matchesTransactionSearch(t, search, accountNameById, tagNameById),
			),
		[transactions, effectiveFilters, accountsById, search, accountNameById, tagNameById],
	);

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

	const selectionRef = useRef(selection);
	selectionRef.current = selection;

	useEffect(() => {
		if (!pendingModal) return;
		if (pendingModal === "new-transaction") {
			const sel = selectionRef.current;
			setNewTxPrefill(
				sel.kind === "account" ? { type: "expense", fromAccountId: sel.account.id } : {},
			);
			setShowNewTx(true);
		} else if (pendingModal === "new-account") {
			setShowNewAccount(true);
		}
		onPendingModalConsumed?.();
	}, [pendingModal, onPendingModalConsumed]);

	const visibleAccountsCount = accounts.filter((a) => !a.is_archived).length;

	const crossFilterChip =
		selection.kind === "account"
			? { label: selection.account.name }
			: selection.kind === "group"
				? { label: selection.group.name }
				: null;

	const rightPaneProps = {
		selection,
		accounts,
		transactions,
		recurrings,
		timezone,
		onClear: clear,
		onPayThisCard: () =>
			openNewTransaction({
				type: "transfer",
				toAccountId: selection.kind === "account" ? selection.account.id : null,
				fromAccountId: null,
			}),
		onWithdrawMatured: () =>
			openNewTransaction({
				type: "transfer",
				fromAccountId: selection.kind === "account" ? selection.account.id : null,
				toAccountId: null,
			}),
	};

	return (
		<div className="card bg-base-100 h-full flex flex-col overflow-hidden">
			{accountsFolded ? (
				// biome-ignore lint/a11y/useSemanticElements: hosts a nested clear button — using <button> would nest interactive content and break HTML5 validity.
				<div
					role="button"
					tabIndex={0}
					aria-label="Expand accounts"
					aria-expanded="false"
					className="h-9 flex items-center gap-2 px-4 bg-base-200 border-b border-base-300 flex-shrink-0 hover:bg-base-300 transition-colors cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
					onClick={() => setAccountsFolded(false)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setAccountsFolded(false);
						}
					}}
				>
					<ChevronDown className="size-3.5 text-base-content/40" />
					<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
						Accounts
					</span>
					<span className="text-xs text-base-content/30">·</span>
					{crossFilterChip ? (
						<>
							<span className="text-xs text-base-content/70">{crossFilterChip.label} selected</span>
							<button
								type="button"
								aria-label="Clear selection"
								className="btn btn-ghost btn-xs btn-circle"
								onClick={(e) => {
									e.stopPropagation();
									clear();
								}}
							>
								<X className="size-3" />
							</button>
						</>
					) : (
						<>
							<span className="text-xs text-base-content/60">
								{visibleAccountsCount} account{visibleAccountsCount !== 1 ? "s" : ""}
							</span>
							<span className="text-xs text-base-content/30">·</span>
							<span className="text-xs tabular-nums text-base-content/70">
								Net {formatCentavos(net.netWorthCentavos)}
							</span>
						</>
					)}
				</div>
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
					<div className="flex-[1_1_35%] flex min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto overflow-x-auto md:basis-1/2 md:flex-none border-r border-base-300">
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
						<div className="hidden md:block md:basis-1/2 md:flex-none overflow-y-auto">
							<AccountsRightPane {...rightPaneProps} />
						</div>
					</div>
					{selection.kind !== "none" && (
						<div className="md:hidden border-t border-base-300">
							<AccountsRightPane {...rightPaneProps} />
						</div>
					)}
				</>
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
						{filteredTransactions.length} transaction
						{filteredTransactions.length !== 1 ? "s" : ""}
					</span>
					<span className="text-xs text-base-content/30">·</span>
					<span className="text-xs tabular-nums text-base-content/70">
						Net flow this month: {netFlow.netCentavos >= 0 ? "+" : ""}
						{formatCentavos(netFlow.netCentavos)}
					</span>
				</button>
			) : (
				<div className="flex-[1_1_65%] flex flex-col overflow-hidden min-h-0">
					<div className="h-9 flex items-center justify-between px-4 flex-shrink-0 border-b border-base-300">
						<div className="flex items-center gap-2 min-w-0">
							<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
								Transactions
							</span>
							<span className="text-xs text-base-content/30">·</span>
							<span className="text-xs text-base-content/60">{filteredTransactions.length}</span>
							{crossFilterChip && (
								<>
									<span className="text-xs text-base-content/30">·</span>
									<span className="text-xs text-base-content/60">filtered to</span>
									<span className="badge badge-sm badge-ghost gap-1 truncate max-w-[16ch]">
										{crossFilterChip.label}
										<button
											type="button"
											aria-label="Clear selection"
											className="hover:text-error"
											onClick={clear}
										>
											<X className="size-3" />
										</button>
									</span>
								</>
							)}
						</div>
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
							dateRange={dateRange}
							search={search}
							onChange={handleSetFilters}
							onDateRangeChange={handleSetDateRange}
							onSearchChange={handleSetSearch}
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
									: "No transactions match these filters."
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
