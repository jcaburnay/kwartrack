import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useReducer, useTable } from "spacetimedb/react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { NewItemCard } from "../components/NewItemCard";
import { PayCreditModal } from "../components/PayCreditModal";
import { SubAccountCard } from "../components/SubAccountCard";
import { SubAccountModal } from "../components/SubAccountModal";
import type { TransactionFilters } from "../components/TransactionFilterRow";
import { TransactionFilterRow } from "../components/TransactionFilterRow";
import { TransactionModal } from "../components/TransactionModal";
import type { TransactionRow } from "../components/TransactionTable";
import { TransactionTable } from "../components/TransactionTable";
import { reducers, tables } from "../module_bindings";
import { getAccountBackground } from "../utils/brandColors";
import { formatPesos } from "../utils/currency";

export function AccountDetailPage() {
	const { id } = useParams<{ id: string }>();
	const accountId = (() => {
		try {
			return BigInt(id ?? "0");
		} catch {
			return 0n;
		}
	})();
	const navigate = useNavigate();
	const deleteSubAccount = useReducer(reducers.deleteSubAccount);
	const deleteTransaction = useReducer(reducers.deleteTransaction);

	const [showSubAccountModal, setShowSubAccountModal] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		type: "sub-account";
		id: bigint;
		name: string;
	} | null>(null);

	const [showPayCredit, setShowPayCredit] = useState(false);
	const [payCreditSubAccountId, setPayCreditSubAccountId] = useState<bigint | null>(null);

	const [editSubAccountData, setEditSubAccountData] = useState<{
		id: bigint;
		name: string;
		subAccountType: string;
		creditLimitCentavos: bigint;
		balanceCentavos: bigint;
		interestRateBps?: number;
		maturityDate?: Date;
	} | null>(null);

	const [showTransactionModal, setShowTransactionModal] = useState(false);
	const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
	const [transactionDeleteTarget, setTransactionDeleteTarget] = useState<TransactionRow | null>(
		null,
	);
	const [filters, setFilters] = useState<TransactionFilters>({
		type: "",
		tag: "",
		dateFrom: "",
		dateTo: "",
	});

	const [accounts, isReady] = useTable(tables.my_accounts);
	const [subAccounts] = useTable(tables.my_sub_accounts);
	const [allTransactions] = useTable(tables.my_transactions);
	const [tdMetadataRows] = useTable(tables.my_time_deposit_metadata);

	if (!isReady) return null;

	// Build time-deposit metadata lookup map
	const tdMetadataMap = new Map(tdMetadataRows.map((m) => [m.subAccountId.toString(), m]));

	// Find the current account from subscription data
	const account = accounts.find((a) => a.id === accountId);

	// Visible sub-accounts (exclude the hidden __default__ sub-account, isDefault:true)
	const visibleSubAccounts = subAccounts.filter(
		(sa) => sa.accountId === accountId && !sa.isDefault,
	);

	// Balance: sum ALL sub-accounts for this account (including isDefault for standalone)
	const totalBalance = subAccounts
		.filter((sa) => sa.accountId === accountId)
		.reduce((sum, sa) => sum + sa.balanceCentavos, 0n);

	// All sub-account IDs for this account (including default)
	const accountSubAccountIds = subAccounts
		.filter((sa) => sa.accountId === accountId)
		.map((sa) => sa.id);

	// Step 1: transactions for this account (D-14 — show all for the account)
	const accountTransactions = allTransactions.filter(
		(t) =>
			accountSubAccountIds.includes(t.sourceSubAccountId) ||
			accountSubAccountIds.includes(t.destinationSubAccountId),
	);

	// Step 2: apply user filters (D-15)
	const filteredTransactions = accountTransactions.filter((t) => {
		if (filters.type && t.type !== filters.type) return false;
		if (filters.tag && t.tag !== filters.tag) return false;
		if (filters.dateFrom) {
			const txnDate = new Date(Number(t.date.microsSinceUnixEpoch / 1000n));
			if (txnDate < new Date(filters.dateFrom)) return false;
		}
		if (filters.dateTo) {
			const txnDate = new Date(Number(t.date.microsSinceUnixEpoch / 1000n));
			if (txnDate > new Date(`${filters.dateTo}T23:59:59`)) return false;
		}
		return true;
	});

	// Account not found (deleted or invalid id)
	if (!account) {
		return (
			<div className="p-4 sm:p-6">
				<p className="text-sm text-base-content/60">Account not found.</p>
				<button
					type="button"
					className="btn btn-ghost btn-sm mt-2"
					onClick={() => navigate("/accounts")}
				>
					Back to Accounts
				</button>
			</div>
		);
	}

	const handleDeleteConfirm = () => {
		if (!deleteTarget) return;
		deleteSubAccount({ subAccountId: deleteTarget.id });
		setDeleteTarget(null);
	};

	const handleTransactionDeleteConfirm = () => {
		if (!transactionDeleteTarget) return;
		deleteTransaction({ transactionId: transactionDeleteTarget.id });
		setTransactionDeleteTarget(null);
	};

	const openCreateModal = () => {
		setEditingTransaction(null);
		setShowTransactionModal(true);
	};

	const openEditModal = (txn: TransactionRow) => {
		setEditingTransaction(txn);
		setShowTransactionModal(true);
	};

	return (
		<div className="p-4 sm:p-6 animate-card-enter">
			<button
				type="button"
				className="btn btn-ghost btn-xs gap-1 mb-4 -ml-1 text-base-content/50"
				onClick={() => navigate("/accounts")}
			>
				<ArrowLeft size={13} />
				Accounts
			</button>

			<div className="flex items-center gap-3 mb-6 min-w-0">
				<span
					className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-base-content/15"
					style={{ background: getAccountBackground(account.name) }}
				/>
				<div className="flex items-baseline gap-4 min-w-0">
					<span className="font-semibold text-base truncate min-w-0">{account.name}</span>
					<span className="font-semibold text-base flex-shrink-0">{formatPesos(totalBalance)}</span>
				</div>
			</div>

			{/* Sub-accounts grouped by type */}
			{(() => {
				const TYPE_ORDER: { key: string; label: string }[] = [
					{ key: "wallet", label: "Ewallet" },
					{ key: "savings", label: "Savings" },
					{ key: "time-deposit", label: "Time Deposit" },
					{ key: "credit", label: "Credit" },
				];
				const grouped = TYPE_ORDER.map(({ key, label }) => ({
					key,
					label,
					items: visibleSubAccounts.filter((sa) => sa.subAccountType === key),
				})).filter((g) => g.items.length > 0);

				let cardIndex = 0;
				return (
					<div className="flex flex-col gap-8">
						{grouped.map(({ key, label, items }) => (
							<div key={key}>
								<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-3">
									{label}
								</h2>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
									{items.map((subAccount) => {
										const delay = cardIndex++ * 0.06;
										const meta = tdMetadataMap.get(subAccount.id.toString());
										return (
											<div
												key={subAccount.id.toString()}
												className="animate-card-enter"
												style={{ animationDelay: `${delay}s` }}
											>
												<SubAccountCard
													id={subAccount.id}
													name={subAccount.name}
													balanceCentavos={subAccount.balanceCentavos}
													subAccountType={subAccount.subAccountType}
													creditLimitCentavos={subAccount.creditLimitCentavos}
													onDeleteRequest={(sid, sname) =>
														setDeleteTarget({
															type: "sub-account" as const,
															id: sid,
															name: sname,
														})
													}
													onPayCredit={(subAccountId) => {
														setPayCreditSubAccountId(subAccountId);
														setShowPayCredit(true);
													}}
													onEdit={(subAccountId) => {
														const sa = visibleSubAccounts.find((s) => s.id === subAccountId);
														if (sa) {
															const tdMeta = tdMetadataMap.get(sa.id.toString());
															setEditSubAccountData({
																id: sa.id,
																name: sa.name,
																subAccountType: sa.subAccountType,
																creditLimitCentavos: sa.creditLimitCentavos,
																balanceCentavos: sa.balanceCentavos,
																interestRateBps: tdMeta?.interestRateBps,
																maturityDate: tdMeta
																	? new Date(
																			Number(tdMeta.maturityDate.microsSinceUnixEpoch / 1000n),
																		)
																	: undefined,
															});
														}
													}}
													interestRateBps={meta?.interestRateBps}
													maturityDate={
														meta
															? new Date(Number(meta.maturityDate.microsSinceUnixEpoch / 1000n))
															: undefined
													}
													isMatured={meta?.isMatured}
												/>
											</div>
										);
									})}
								</div>
							</div>
						))}
						{/* Adding first sub-account triggers standalone→partitioned conversion (D-08) */}
						<div>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
								<NewItemCard label="New sub-account" onClick={() => setShowSubAccountModal(true)} />
							</div>
						</div>
					</div>
				);
			})()}

			{/* TRANSACTIONS section — 48px gap from sub-accounts section (UI-SPEC: 2xl gap) */}
			<div className="mt-10">
				<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-4">
					TRANSACTIONS
				</h2>

				{/* Filter row (D-15) */}
				<div className="mt-3">
					<TransactionFilterRow filters={filters} onChange={setFilters} />
				</div>

				{/* Transaction table (D-12, D-13) */}
				<div className="mt-3">
					<TransactionTable
						transactions={filteredTransactions}
						accounts={accounts}
						subAccounts={subAccounts}
						hasActiveFilters={!!(filters.type || filters.tag || filters.dateFrom || filters.dateTo)}
						onEdit={openEditModal}
						onDelete={setTransactionDeleteTarget}
						onAddNew={openCreateModal}
					/>
				</div>
			</div>

			{/* Modals */}
			{showSubAccountModal && (
				<SubAccountModal
					accountId={accountId}
					accountName={account.name}
					isStandalone={account.isStandalone}
					existingBalanceCentavos={totalBalance}
					onClose={() => setShowSubAccountModal(false)}
				/>
			)}

			{editSubAccountData && (
				<SubAccountModal
					accountId={accountId}
					accountName={account.name}
					isStandalone={false}
					existingBalanceCentavos={0n}
					onClose={() => setEditSubAccountData(null)}
					subAccount={editSubAccountData}
				/>
			)}

			{deleteTarget && (
				<DeleteConfirmModal
					title={`Delete ${deleteTarget.name}?`}
					body={`This will permanently delete the sub-account ${deleteTarget.name}. This cannot be undone.`}
					confirmLabel={`Delete ${deleteTarget.name}`}
					dismissLabel="Cancel"
					onConfirm={handleDeleteConfirm}
					onDismiss={() => setDeleteTarget(null)}
				/>
			)}

			{/* TransactionModal (create or edit) */}
			{showTransactionModal && (
				<TransactionModal
					transaction={editingTransaction ?? undefined}
					onClose={() => {
						setShowTransactionModal(false);
						setEditingTransaction(null);
					}}
				/>
			)}

			{/* Delete transaction confirmation */}
			{transactionDeleteTarget && (
				<DeleteConfirmModal
					title="Delete transaction?"
					body="This will permanently delete this transaction and recalculate the affected sub-account balances. This cannot be undone."
					confirmLabel="Delete transaction"
					dismissLabel="Keep transaction"
					onConfirm={handleTransactionDeleteConfirm}
					onDismiss={() => setTransactionDeleteTarget(null)}
				/>
			)}

			{/* PayCreditModal — opens when Pay Credit is clicked */}
			{showPayCredit &&
				payCreditSubAccountId !== null &&
				(() => {
					const creditSubAccount = visibleSubAccounts.find((sa) => sa.id === payCreditSubAccountId);
					return creditSubAccount ? (
						<PayCreditModal
							subAccountId={payCreditSubAccountId}
							outstandingCentavos={creditSubAccount.balanceCentavos}
							onClose={() => {
								setShowPayCredit(false);
								setPayCreditSubAccountId(null);
							}}
						/>
					) : null;
				})()}
		</div>
	);
}
