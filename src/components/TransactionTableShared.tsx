import { ArrowLeftRight, Search } from "lucide-react";
import { formatPesos } from "../utils/currency";
import { TransactionRowActions } from "./TransactionRowActions";
import type { TransactionRow } from "./TransactionTable";

interface TransactionItemProps {
	txn: TransactionRow;
	onEdit: (txn: TransactionRow) => void;
	formatDate: (ts: { microsSinceUnixEpoch: bigint }) => string;
	amountClass: (type: string) => string;
	typeBadgeClass: (type: string) => string;
}

export function TransactionItem({
	txn,
	onEdit,
	formatDate,
	amountClass,
	typeBadgeClass,
}: TransactionItemProps) {
	return (
		<button
			type="button"
			className="rounded-xl bg-base-100 shadow-sm border border-base-300/50 p-3 text-left cursor-pointer hover:bg-base-300 transition-colors"
			onClick={() => onEdit(txn)}
		>
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium truncate max-w-[60%]">
					{txn.isRecurring && <span className="mr-0.5 opacity-60">&#8635;</span>}
					{txn.description || txn.tag?.replace(/-/g, " ")}
				</span>
				<span className={amountClass(txn.type)}>{formatPesos(txn.amountCentavos)}</span>
			</div>
			<div className="flex items-center gap-2 mt-1">
				<span className="text-xs text-base-content/60">{formatDate(txn.date)}</span>
				<span className={typeBadgeClass(txn.type)}>{txn.type}</span>
				{txn.tag && (
					<span className="text-xs text-base-content/60 capitalize">
						{txn.tag.replace(/-/g, " ")}
					</span>
				)}
			</div>
		</button>
	);
}

interface TransactionEmptyStateProps {
	hasActiveFilters: boolean;
}

export function TransactionEmptyState({ hasActiveFilters }: TransactionEmptyStateProps) {
	return (
		<div className="py-6 text-center">
			<div className="flex flex-col items-center gap-2 text-base-content/60">
				{hasActiveFilters ? (
					<>
						<Search size={20} />
						<span className="text-sm">No transactions match your filters</span>
					</>
				) : (
					<>
						<ArrowLeftRight size={20} />
						<span className="text-sm">No transactions yet</span>
					</>
				)}
			</div>
		</div>
	);
}

interface TransactionRowProps extends TransactionItemProps {
	accounts: readonly { id: bigint; name: string }[];
	subAccounts: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[];
	colCount: number;
	onDelete: (txn: TransactionRow) => void;
	formatSubAccountLabel: (
		subAccountId: bigint,
		accounts: readonly { id: bigint; name: string }[],
		subAccounts: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
	) => string;
}

export function TransactionTableRow({
	txn,
	accounts,
	subAccounts,
	onEdit,
	onDelete,
	formatDate,
	formatSubAccountLabel,
	amountClass,
	typeBadgeClass,
}: TransactionRowProps) {
	return (
		<tr>
			<td className={amountClass(txn.type)}>
				{txn.isRecurring && (
					<span title="Auto-created recurring transaction" className="mr-0.5 opacity-60">
						↻
					</span>
				)}
				{formatPesos(txn.amountCentavos)}
			</td>
			<td>
				<span className={typeBadgeClass(txn.type)}>{txn.type}</span>
			</td>
			<td className="text-sm capitalize">{txn.tag?.replace(/-/g, " ")}</td>
			<td className="text-sm whitespace-nowrap">
				{formatSubAccountLabel(txn.sourceSubAccountId, accounts, subAccounts)}
			</td>
			<td className="text-sm whitespace-nowrap">
				{formatSubAccountLabel(txn.destinationSubAccountId, accounts, subAccounts)}
			</td>
			<td className="text-sm text-base-content/60 font-mono">
				{txn.serviceFeeCentavos !== 0n ? formatPesos(txn.serviceFeeCentavos) : ""}
			</td>
			<td className="text-sm text-base-content/60">{txn.description || "—"}</td>
			<td className="text-sm whitespace-nowrap">{formatDate(txn.date)}</td>
			<td>
				<TransactionRowActions onEdit={() => onEdit(txn)} onDelete={() => onDelete(txn)} />
			</td>
		</tr>
	);
}
