import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AccountsTable } from "../components/accounts/AccountsTable";
import { EditAccountModal } from "../components/accounts/EditAccountModal";
import { NewAccountModal } from "../components/accounts/NewAccountModal";
import { Fab } from "../components/Fab";
import { Header } from "../components/Header";
import { NewRecurringModal } from "../components/recurring/NewRecurringModal";
import type { RecurringFormValues } from "../components/recurring/RecurringForm";
import { AccountDetailStrip } from "../components/strips/AccountDetailStrip";
import { EditTransactionModal } from "../components/transactions/EditTransactionModal";
import { NewTransactionModal } from "../components/transactions/NewTransactionModal";
import { TransactionFilterBar } from "../components/transactions/TransactionFilterBar";
import type { TransactionFormValues } from "../components/transactions/TransactionForm";
import { TransactionsTable } from "../components/transactions/TransactionsTable";
import { useAccountGroups } from "../hooks/useAccountGroups";
import { useAccounts } from "../hooks/useAccounts";
import { useRecurrings } from "../hooks/useRecurrings";
import { useSelectedAccount } from "../hooks/useSelectedAccount";
import { useTags } from "../hooks/useTags";
import { useTransactions } from "../hooks/useTransactions";
import { useAuth } from "../providers/AuthProvider";
import type { Account } from "../utils/accountBalances";
import { computeNetWorth } from "../utils/accountBalances";
import { formatCentavos } from "../utils/currency";
import {
	type AccountLookup,
	EMPTY_FILTERS,
	matchesFilters,
	type Transaction,
	type TransactionFilters,
} from "../utils/transactionFilters";

export function AccountsPage() {
	const { profile } = useAuth();
	const { accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
	const { groups, refetch: refetchGroups } = useAccountGroups();
	const { transactions, refetch: refetchTransactions } = useTransactions();
	const { tags, createInline } = useTags();
	const { selection, selectAccount, selectGroup, clear } = useSelectedAccount(accounts, groups);

	const [fabOpen, setFabOpen] = useState(false);
	const [showNewAccount, setShowNewAccount] = useState(false);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [showArchived, setShowArchived] = useState(false);

	const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
	const [showNewTx, setShowNewTx] = useState(false);
	const [newTxPrefill, setNewTxPrefill] = useState<Partial<TransactionFormValues>>({});
	const [editingTx, setEditingTx] = useState<Transaction | null>(null);

	const { recurrings, createRecurring } = useRecurrings();
	const [showNewRecurring, setShowNewRecurring] = useState(false);
	const [newRecurringPrefill, setNewRecurringPrefill] = useState<Partial<RecurringFormValues>>({});
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const typeFilterRaw = params.get("type");
	const typeFilter =
		typeFilterRaw === "cash" ||
		typeFilterRaw === "e-wallet" ||
		typeFilterRaw === "savings" ||
		typeFilterRaw === "credit" ||
		typeFilterRaw === "time-deposit"
			? typeFilterRaw
			: null;

	const net = computeNetWorth(accounts);
	const timezone = profile?.timezone ?? "Asia/Manila";

	// Lookup map so the filter predicate can check group membership cheaply.
	const accountsById = useMemo(() => {
		const m = new Map<string, AccountLookup>();
		for (const a of accounts) m.set(a.id, { id: a.id, groupId: a.group_id });
		return m;
	}, [accounts]);

	// Compose URL selection with filter-bar state.
	const effectiveFilters: TransactionFilters = useMemo(() => {
		if (selection.kind === "account") {
			return { ...filters, accountId: selection.account.id, groupId: null };
		}
		if (selection.kind === "group") {
			return { ...filters, groupId: selection.group.id, accountId: null };
		}
		return filters;
	}, [selection, filters]);

	const filteredTransactions = useMemo(
		() => transactions.filter((t) => matchesFilters(t, effectiveFilters, accountsById)),
		[transactions, effectiveFilters, accountsById],
	);

	function openNewTransaction(prefill: Partial<TransactionFormValues>) {
		setNewTxPrefill(prefill);
		setShowNewTx(true);
	}

	function openNewTransactionFromFab() {
		// Pre-fill based on current account/group selection.
		if (selection.kind === "account") {
			const type: "expense" | "income" | "transfer" = "expense";
			openNewTransaction({
				type,
				fromAccountId: selection.account.id,
			});
		} else {
			openNewTransaction({});
		}
	}

	function openNewRecurringFromFab() {
		if (selection.kind === "account") {
			setNewRecurringPrefill({
				type: "expense",
				fromAccountId: selection.account.id,
			});
		} else {
			setNewRecurringPrefill({});
		}
		setShowNewRecurring(true);
	}

	function openPayThisCard(accountId: string) {
		openNewTransaction({
			type: "transfer",
			toAccountId: accountId,
			fromAccountId: null,
		});
	}

	async function onTxChanged() {
		await Promise.all([refetchTransactions(), refetchAccounts()]);
	}

	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<Header />
			<main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto flex flex-col gap-5">
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
						recurrings={recurrings}
						selectedAccountId={selection.kind === "account" ? selection.account.id : null}
						selectedGroupId={selection.kind === "group" ? selection.group.id : null}
						onSelectAccount={selectAccount}
						onSelectGroup={selectGroup}
						onEdit={(a) => setEditingAccount(a)}
						onChanged={() => refetchAccounts()}
						showArchived={showArchived}
						typeFilter={typeFilter}
					/>
				)}

				{selection.kind === "account" && (
					<AccountDetailStrip
						account={selection.account}
						transactions={transactions}
						recurrings={recurrings}
						timezone={timezone}
						onClear={clear}
						onPayThisCard={() => openPayThisCard(selection.account.id)}
					/>
				)}

				{accounts.length > 0 && (
					<>
						<section className="flex flex-col gap-2">
							<h2 className="text-lg font-semibold">Transactions</h2>
							<TransactionFilterBar
								filters={filters}
								onChange={setFilters}
								accounts={accounts}
								groups={groups}
								tags={tags}
							/>
						</section>
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
									: "No transactions yet. Create one from the + button."
							}
						/>
					</>
				)}
			</main>

			<Fab
				isOpen={fabOpen}
				onToggle={() => setFabOpen((v) => !v)}
				onDismiss={() => setFabOpen(false)}
				actions={[
					{
						label: "New Transaction",
						description: "Expense, income, or transfer.",
						onClick: openNewTransactionFromFab,
					},
					{
						label: "New Split",
						description: "Splitwise-style group expense.",
						onClick: () => navigate("/debts-and-splits?modal=new-split"),
					},
					{
						label: "New Debt",
						description: "Standalone IOU.",
						onClick: () => navigate("/debts-and-splits?modal=new-debt"),
					},
					{
						label: "New Recurring",
						description: "Subscription, installment, or recurring income.",
						onClick: openNewRecurringFromFab,
					},
					{
						label: "New Account",
						description: "Cash, e-wallet, savings, credit, or time deposit.",
						onClick: () => setShowNewAccount(true),
					},
				]}
			/>

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

			{showNewRecurring && (
				<NewRecurringModal
					accounts={accounts}
					tags={tags}
					createTag={createInline}
					createRecurring={createRecurring}
					prefill={newRecurringPrefill}
					onSaved={() => {
						setShowNewRecurring(false);
						setNewRecurringPrefill({});
					}}
					onCancel={() => {
						setShowNewRecurring(false);
						setNewRecurringPrefill({});
					}}
				/>
			)}
		</div>
	);
}
