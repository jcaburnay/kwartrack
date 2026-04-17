import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { fromTimestamp } from "../utils/date";
import {
	TransactionEmptyState,
	TransactionItem,
	TransactionTableRow,
} from "./TransactionTableShared";

export interface TransactionRow {
	id: bigint;
	type: string;
	amountCentavos: bigint;
	tag: string;
	sourceSubAccountId: bigint;
	destinationSubAccountId: bigint;
	serviceFeeCentavos: bigint;
	description: string;
	date: { microsSinceUnixEpoch: bigint };
	createdAt?: { microsSinceUnixEpoch: bigint };
	isRecurring?: boolean;
	recurringDefinitionId?: bigint;
}

interface TransactionTableProps {
	transactions: TransactionRow[];
	accounts: readonly { id: bigint; name: string }[];
	subAccounts: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[];
	hasActiveFilters: boolean;
	onEdit: (transaction: TransactionRow) => void;
	onDelete: (transaction: TransactionRow) => void;
	onAddNew: () => void;
}

function formatSubAccountLabel(
	subAccountId: bigint,
	accounts: readonly { id: bigint; name: string }[],
	subAccounts: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
): string {
	if (subAccountId === 0n) return "";
	const subAccount = subAccounts.find((sa) => sa.id === subAccountId);
	if (!subAccount) return "";
	const account = accounts.find((a) => a.id === subAccount.accountId);
	if (!account) return "";
	if (subAccount.isDefault) return account.name;
	return `${account.name}/${subAccount.name}`;
}

export function formatAccountLabel(
	txn: TransactionRow,
	accounts: readonly { id: bigint; name: string }[],
	subAccounts: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
): string {
	const srcPart = subAccounts.find((sa) => sa.id === txn.sourceSubAccountId);
	const dstPart = subAccounts.find((sa) => sa.id === txn.destinationSubAccountId);
	const srcAcct = srcPart ? accounts.find((a) => a.id === srcPart.accountId) : null;
	const dstAcct = dstPart ? accounts.find((a) => a.id === dstPart.accountId) : null;

	if (txn.type === "expense") return srcAcct?.name ?? "";
	if (txn.type === "income") return dstAcct?.name ?? "";
	if (srcAcct && dstAcct && srcAcct.id !== dstAcct.id) {
		return `${srcAcct.name} → ${dstAcct.name}`;
	}
	return srcAcct?.name ?? dstAcct?.name ?? "";
}

function formatDate(ts: { microsSinceUnixEpoch: bigint }): string {
	const date = fromTimestamp(ts);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function amountClass(type: string): string {
	if (type === "expense") return "text-error font-semibold font-mono";
	if (type === "income") return "text-success font-semibold font-mono";
	return "text-base-content font-semibold font-mono";
}

function typeBadgeClass(type: string): string {
	if (type === "expense") return "badge badge-sm badge-error";
	if (type === "income") return "badge badge-sm badge-success";
	return "badge badge-sm badge-neutral";
}

export function TransactionTable({
	transactions,
	accounts,
	subAccounts,
	hasActiveFilters,
	onEdit,
	onDelete,
	onAddNew,
}: TransactionTableProps) {
	const colCount = 9;

	const sorted = useMemo(
		() =>
			[...transactions].sort((a, b) => {
				const microsPerDay = 86_400_000_000n;
				const aDay = a.date.microsSinceUnixEpoch / microsPerDay;
				const bDay = b.date.microsSinceUnixEpoch / microsPerDay;
				const dayDiff = bDay - aDay;
				if (dayDiff !== 0n) return dayDiff > 0n ? 1 : -1;
				const bCreated = b.createdAt?.microsSinceUnixEpoch ?? 0n;
				const aCreated = a.createdAt?.microsSinceUnixEpoch ?? 0n;
				return bCreated > aCreated ? 1 : -1;
			}),
		[transactions],
	);

	const handleEdit = useCallback((txn: TransactionRow) => onEdit(txn), [onEdit]);
	const handleDelete = useCallback((txn: TransactionRow) => onDelete(txn), [onDelete]);

	return (
		<>
			{/* Mobile Add Button */}
			<div className="md:hidden mb-2">
				<button
					type="button"
					onClick={onAddNew}
					className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-3 border border-dashed border-base-content/30 rounded text-base-content/60 hover:text-base-content/80 hover:border-base-content/50 transition-colors text-sm cursor-pointer"
				>
					<Plus size={14} />
					New transaction
				</button>
			</div>

			{sorted.length === 0 && <TransactionEmptyState hasActiveFilters={hasActiveFilters} />}

			{/* Desktop table layout with mobile-hidden columns and custom mobile list items */}
			<div className="overflow-visible">
				{/* Mobile list view */}
				<div className="flex flex-col gap-2 md:hidden">
					{sorted.map((txn) => (
						<TransactionItem
							key={txn.id.toString()}
							txn={txn}
							onEdit={handleEdit}
							formatDate={formatDate}
							amountClass={amountClass}
							typeBadgeClass={typeBadgeClass}
						/>
					))}
				</div>

				{/* Desktop table view */}
				<div className="hidden md:block overflow-x-auto">
					<table className="table table-sm w-full">
						<thead>
							<tr className="bg-base-200">
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									AMOUNT
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									TYPE
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									TAG
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									FROM
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									TO
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									FEE
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									DESCRIPTION
								</th>
								<th className="text-xs font-semibold tracking-widest text-base-content/60 uppercase">
									DATE
								</th>
								<th />
							</tr>
						</thead>
						<tbody>
							<tr>
								<td colSpan={colCount} className="py-1">
									<button
										type="button"
										onClick={onAddNew}
										className="inline-flex items-center gap-2 min-h-[44px] px-3 border border-dashed border-base-content/30 rounded text-base-content/60 hover:text-base-content/80 hover:border-base-content/50 transition-colors text-sm cursor-pointer"
									>
										<Plus size={14} />
										New transaction
									</button>
								</td>
							</tr>
							{sorted.map((txn) => (
								<TransactionTableRow
									key={txn.id.toString()}
									txn={txn}
									accounts={accounts}
									subAccounts={subAccounts}
									colCount={colCount}
									onEdit={handleEdit}
									onDelete={handleDelete}
									formatDate={formatDate}
									formatSubAccountLabel={formatSubAccountLabel}
									amountClass={amountClass}
									typeBadgeClass={typeBadgeClass}
								/>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
