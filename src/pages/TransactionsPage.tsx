import { useMemo, useState } from "react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import type { TransactionFilters } from "../components/TransactionFilterRow";
import { TransactionFilterRow } from "../components/TransactionFilterRow";
import { TransactionModal } from "../components/TransactionModal";
import type { TransactionRow } from "../components/TransactionTable";
import { TransactionTable } from "../components/TransactionTable";
import { useAccounts, useSubAccounts, useTransactionActions, useTransactions } from "../hooks";
import { fromTimestamp } from "../utils/date";

export function TransactionsPage() {
	const { remove: deleteTransaction } = useTransactionActions();

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

	const { accounts } = useAccounts();
	const { subAccounts } = useSubAccounts();
	const { transactions: allTransactions, isLoading: isReady } = useTransactions();

	// Filter by account/partition
	const accountFiltered = useMemo(() => {
		const ap = filters.accountPartition;
		if (!ap) return allTransactions;

		if (ap.startsWith("account:")) {
			try {
				const accountId = BigInt(ap.split(":")[1]);
				const partIds = subAccounts.filter((p) => p.accountId === accountId).map((p) => p.id);
				return allTransactions.filter(
					(t) =>
						partIds.includes(t.sourceSubAccountId) || partIds.includes(t.destinationSubAccountId),
				);
			} catch {
				return allTransactions;
			}
		}

		if (ap.startsWith("partition:")) {
			try {
				const partId = BigInt(ap.split(":")[1]);
				return allTransactions.filter(
					(t) => t.sourceSubAccountId === partId || t.destinationSubAccountId === partId,
				);
			} catch {
				return allTransactions;
			}
		}

		return allTransactions;
	}, [filters.accountPartition, allTransactions, subAccounts]);

	// Apply type/tag/date filters (same logic as AccountDetailPage)
	const filteredTransactions = useMemo(() => {
		return accountFiltered.filter((t) => {
			if (filters.type && t.type !== filters.type) return false;
			if (filters.tag && t.tag !== filters.tag) return false;
			if (filters.dateFrom) {
				const txnDate = fromTimestamp(t.date);
				if (txnDate < new Date(filters.dateFrom)) return false;
			}
			if (filters.dateTo) {
				const txnDate = fromTimestamp(t.date);
				if (txnDate > new Date(`${filters.dateTo}T23:59:59`)) return false;
			}
			return true;
		});
	}, [accountFiltered, filters.type, filters.tag, filters.dateFrom, filters.dateTo]);

	if (!isReady) return null;

	const hasActiveFilters = !!(
		filters.type ||
		filters.tag ||
		filters.dateFrom ||
		filters.dateTo ||
		filters.accountPartition
	);

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
		<div className="p-4 sm:p-6 pb-24 sm:pb-24 ">
			<h1 className="text-xs font-medium tracking-widest text-base-content/60 uppercase mb-5 ">
				TRANSACTIONS
			</h1>

			{/* Filter row with account filter */}
			<div className="relative z-10 mt-3 ">
				<TransactionFilterRow
					filters={filters}
					onChange={setFilters}
					accounts={accounts}
					subAccounts={subAccounts}
				/>
			</div>

			{/* Transaction table with account column */}
			<div className="mt-3 ">
				<TransactionTable
					transactions={filteredTransactions}
					accounts={accounts}
					subAccounts={subAccounts}
					hasActiveFilters={hasActiveFilters}
					onEdit={openEditModal}
					onDelete={setTransactionDeleteTarget}
					onAddNew={openCreateModal}
				/>
			</div>

			{/* Transaction count */}
			<div className="mt-2 text-xs text-base-content/60 text-right">
				{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
			</div>

			{/* TransactionModal (create or edit) */}
			{showTransactionModal && (
				<TransactionModal
					transaction={editingTransaction ?? undefined}
					onClose={() => {
						setShowTransactionModal(false);
						setEditingTransaction(null);
					}}
					onDelete={
						editingTransaction
							? () => {
									const target = editingTransaction;
									setShowTransactionModal(false);
									setEditingTransaction(null);
									setTransactionDeleteTarget(target);
								}
							: undefined
					}
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
		</div>
	);
}
