import { useState } from "react";
import { useReducer, useTable } from "spacetimedb/react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import type { TransactionFilters } from "../components/TransactionFilterRow";
import { TransactionFilterRow } from "../components/TransactionFilterRow";
import { TransactionModal } from "../components/TransactionModal";
import type { TransactionRow } from "../components/TransactionTable";
import { TransactionTable } from "../components/TransactionTable";
import { reducers, tables } from "../module_bindings";

export function TransactionsPage() {
	const deleteTransaction = useReducer(reducers.deleteTransaction);

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

	const [accounts] = useTable(tables.my_accounts);
	const [partitions] = useTable(tables.my_partitions);
	const [allTransactions, isReady] = useTable(tables.my_transactions);

	// Filter by account/partition
	const accountFiltered = (() => {
		const ap = filters.accountPartition;
		if (!ap) return allTransactions;

		if (ap.startsWith("account:")) {
			const accountId = BigInt(ap.split(":")[1]);
			const partIds = partitions.filter((p) => p.accountId === accountId).map((p) => p.id);
			return allTransactions.filter(
				(t) => partIds.includes(t.sourcePartitionId) || partIds.includes(t.destinationPartitionId),
			);
		}

		if (ap.startsWith("partition:")) {
			const partId = BigInt(ap.split(":")[1]);
			return allTransactions.filter(
				(t) => t.sourcePartitionId === partId || t.destinationPartitionId === partId,
			);
		}

		return allTransactions;
	})();

	// Apply type/tag/date filters (same logic as AccountDetailPage)
	const filteredTransactions = accountFiltered.filter((t) => {
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

	if (!isReady) return null;

	return (
		<div className="p-4 sm:p-6">
			<p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-5 animate-card-enter">
				TRANSACTIONS
			</p>

			{/* Filter row with account filter */}
			<div className="mt-3 animate-card-enter" style={{ animationDelay: `0.06s` }}>
				<TransactionFilterRow
					filters={filters}
					onChange={setFilters}
					accounts={accounts}
					partitions={partitions}
				/>
			</div>

			{/* Transaction table with account column */}
			<div className="mt-3 animate-card-enter" style={{ animationDelay: `0.12s` }}>
				<TransactionTable
					transactions={filteredTransactions}
					accounts={accounts}
					partitions={partitions}
					hasActiveFilters={hasActiveFilters}
					onEdit={openEditModal}
					onDelete={setTransactionDeleteTarget}
					onAddNew={openCreateModal}
					showAccountColumn
				/>
			</div>

			{/* Transaction count */}
			<div className="mt-2 text-xs text-base-content/35 text-right">
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
				/>
			)}

			{/* Delete transaction confirmation */}
			{transactionDeleteTarget && (
				<DeleteConfirmModal
					title="Delete transaction?"
					body="This will permanently delete this transaction and recalculate the affected partition balances. This cannot be undone."
					confirmLabel="Delete transaction"
					dismissLabel="Keep transaction"
					onConfirm={handleTransactionDeleteConfirm}
					onDismiss={() => setTransactionDeleteTarget(null)}
				/>
			)}
		</div>
	);
}
