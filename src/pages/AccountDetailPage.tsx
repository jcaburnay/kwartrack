import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useReducer, useTable } from "spacetimedb/react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { NewPartitionCard } from "../components/NewPartitionCard";
import { PartitionCard } from "../components/PartitionCard";
import { PartitionModal } from "../components/PartitionModal";
import { PayCreditModal } from "../components/PayCreditModal";
import type { TransactionFilters } from "../components/TransactionFilterRow";
import { TransactionFilterRow } from "../components/TransactionFilterRow";
import { TransactionModal } from "../components/TransactionModal";
import type { TransactionRow } from "../components/TransactionTable";
import { TransactionTable } from "../components/TransactionTable";
import { reducers, tables } from "../module_bindings";
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
	const deletePartition = useReducer(reducers.deletePartition);
	const deleteTransaction = useReducer(reducers.deleteTransaction);

	const [showPartitionModal, setShowPartitionModal] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		type: "partition";
		id: bigint;
		name: string;
	} | null>(null);

	const [showPayCredit, setShowPayCredit] = useState(false);
	const [payCreditPartitionId, setPayCreditPartitionId] = useState<bigint | null>(null);

	const [editPartitionData, setEditPartitionData] = useState<{
		id: bigint;
		name: string;
		partitionType: string;
		creditLimitCentavos: bigint;
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
	const [partitions] = useTable(tables.my_partitions);
	const [allTransactions] = useTable(tables.my_transactions);

	if (!isReady) return null;

	// Find the current account from subscription data
	const account = accounts.find((a) => a.id === accountId);

	// Visible partitions (exclude the hidden __default__ partition, isDefault:true)
	const visiblePartitions = partitions.filter((p) => p.accountId === accountId && !p.isDefault);

	// Balance: sum ALL partitions for this account (including isDefault for standalone)
	const totalBalance = partitions
		.filter((p) => p.accountId === accountId)
		.reduce((sum, p) => sum + p.balanceCentavos, 0n);

	// All partition IDs for this account (including default)
	const accountPartitionIds = partitions.filter((p) => p.accountId === accountId).map((p) => p.id);

	// Step 1: transactions for this account (D-14 — show all for the account)
	const accountTransactions = allTransactions.filter(
		(t) =>
			accountPartitionIds.includes(t.sourcePartitionId) ||
			accountPartitionIds.includes(t.destinationPartitionId),
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
		deletePartition({ partitionId: deleteTarget.id });
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

			<div className="flex items-baseline gap-4 mb-6 min-w-0">
				<span className="font-semibold text-base truncate min-w-0">{account.name}</span>
				<span className="font-semibold text-base flex-shrink-0">{formatPesos(totalBalance)}</span>
			</div>

			{/* Partition grid — same layout for standalone and partitioned */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{visiblePartitions.map((partition, index) => (
					<div
						key={partition.id.toString()}
						className="animate-card-enter"
						style={{ animationDelay: `${index * 0.06}s` }}
					>
						<PartitionCard
							id={partition.id}
							name={partition.name}
							balanceCentavos={partition.balanceCentavos}
							partitionType={partition.partitionType}
							creditLimitCentavos={partition.creditLimitCentavos}
							onDeleteRequest={(pid, pname) =>
								setDeleteTarget({
									type: "partition" as const,
									id: pid,
									name: pname,
								})
							}
							onPayCredit={(partitionId) => {
								setPayCreditPartitionId(partitionId);
								setShowPayCredit(true);
							}}
							onEdit={(partitionId) => {
								const part = visiblePartitions.find((p) => p.id === partitionId);
								if (part) {
									setEditPartitionData({
										id: part.id,
										name: part.name,
										partitionType: part.partitionType,
										creditLimitCentavos: part.creditLimitCentavos,
									});
								}
							}}
						/>
					</div>
				))}
				{/* Adding first partition triggers standalone→partitioned conversion (D-08) */}
				<NewPartitionCard onClick={() => setShowPartitionModal(true)} />
			</div>

			{/* TRANSACTIONS section — 48px gap from partitions section (UI-SPEC: 2xl gap) */}
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
						partitions={partitions}
						hasActiveFilters={!!(filters.type || filters.tag || filters.dateFrom || filters.dateTo)}
						onEdit={openEditModal}
						onDelete={setTransactionDeleteTarget}
						onAddNew={openCreateModal}
					/>
				</div>
			</div>

			{/* Modals */}
			{showPartitionModal && (
				<PartitionModal
					accountId={accountId}
					isStandalone={account.isStandalone}
					onClose={() => setShowPartitionModal(false)}
				/>
			)}

			{editPartitionData && (
				<PartitionModal
					accountId={accountId}
					isStandalone={account.isStandalone}
					onClose={() => setEditPartitionData(null)}
					partition={editPartitionData}
				/>
			)}

			{deleteTarget && (
				<DeleteConfirmModal
					title={`Delete ${deleteTarget.name}?`}
					body={`This will permanently delete ${deleteTarget.name}. This cannot be undone.`}
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
					body="This will permanently delete this transaction and recalculate the affected partition balances. This cannot be undone."
					confirmLabel="Delete transaction"
					dismissLabel="Keep transaction"
					onConfirm={handleTransactionDeleteConfirm}
					onDismiss={() => setTransactionDeleteTarget(null)}
				/>
			)}

			{/* PayCreditModal — opens when Pay Credit is clicked */}
			{showPayCredit &&
				payCreditPartitionId !== null &&
				(() => {
					const creditPart = visiblePartitions.find((p) => p.id === payCreditPartitionId);
					return creditPart ? (
						<PayCreditModal
							partitionId={payCreditPartitionId}
							outstandingCentavos={creditPart.balanceCentavos}
							onClose={() => {
								setShowPayCredit(false);
								setPayCreditPartitionId(null);
							}}
						/>
					) : null;
				})()}
		</div>
	);
}
