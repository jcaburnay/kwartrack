import { ArrowLeftRight, Plus, Search } from "lucide-react";
import { useMemo } from "react";
import { formatPesos } from "../utils/currency";
import { TransactionRowActions } from "./TransactionRowActions";

export interface TransactionRow {
	id: bigint;
	type: string;
	amountCentavos: bigint;
	tag: string;
	sourcePartitionId: bigint;
	destinationPartitionId: bigint;
	serviceFeeCentavos: bigint;
	description: string;
	date: { microsSinceUnixEpoch: bigint };
	isRecurring?: boolean;
	recurringDefinitionId?: bigint;
}

interface TransactionTableProps {
	transactions: TransactionRow[];
	accounts: readonly { id: bigint; name: string }[];
	partitions: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[];
	hasActiveFilters: boolean;
	onEdit: (transaction: TransactionRow) => void;
	onDelete: (transaction: TransactionRow) => void;
	onAddNew: () => void;
	showAccountColumn?: boolean;
}

function formatPartitionLabel(
	partitionId: bigint,
	accounts: readonly { id: bigint; name: string }[],
	partitions: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
): string {
	if (partitionId === 0n) return "";
	const partition = partitions.find((p) => p.id === partitionId);
	if (!partition) return "";
	const account = accounts.find((a) => a.id === partition.accountId);
	if (!account) return "";
	if (partition.isDefault) return account.name;
	return `${account.name}/${partition.name}`;
}

export function formatAccountLabel(
	txn: TransactionRow,
	accounts: readonly { id: bigint; name: string }[],
	partitions: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[],
): string {
	const srcPart = partitions.find((p) => p.id === txn.sourcePartitionId);
	const dstPart = partitions.find((p) => p.id === txn.destinationPartitionId);
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
	const date = new Date(Number(ts.microsSinceUnixEpoch / 1000n));
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
	partitions,
	hasActiveFilters,
	onEdit,
	onDelete,
	onAddNew,
	showAccountColumn,
}: TransactionTableProps) {
	const colCount = showAccountColumn ? 10 : 9;
	const sorted = useMemo(
		() =>
			[...transactions].sort((a, b) =>
				b.date.microsSinceUnixEpoch > a.date.microsSinceUnixEpoch ? 1 : -1,
			),
		[transactions],
	);

	return (
		<>
			{/* Mobile card list - per D-06 */}
			<div className="flex flex-col gap-2 sm:hidden">
				{/* New transaction button */}
				<button
					type="button"
					onClick={onAddNew}
					className="inline-flex items-center gap-2 h-[36px] px-3 border border-dashed border-base-content/20 rounded text-base-content/40 hover:text-base-content/60 hover:border-base-content/40 transition-colors text-sm cursor-pointer"
				>
					<Plus size={14} />
					New transaction
				</button>

				{sorted.length === 0 && (
					<div className="py-6 text-center">
						<div className="flex flex-col items-center gap-2 text-base-content/40">
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
				)}

				{sorted.map((txn) => (
					<button
						key={txn.id.toString()}
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
							{showAccountColumn && (
								<span className="text-xs text-base-content/35">
									· {formatAccountLabel(txn, accounts, partitions)}
								</span>
							)}
						</div>
					</button>
				))}
			</div>

			{/* Desktop table */}
			<div className="hidden sm:block overflow-visible">
				<table className="table table-sm w-full">
					<thead>
						<tr className="bg-base-200">
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								AMOUNT
							</th>
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								TYPE
							</th>
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								TAG
							</th>
							{showAccountColumn && (
								<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
									ACCOUNT
								</th>
							)}
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								FROM
							</th>
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								TO
							</th>
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								FEE
							</th>
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
								DESCRIPTION
							</th>
							<th className="text-xs font-semibold tracking-widest text-base-content/40 uppercase">
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
									className="inline-flex items-center gap-2 h-[36px] px-3 border border-dashed border-base-content/20 rounded text-base-content/40 hover:text-base-content/60 hover:border-base-content/40 transition-colors text-sm cursor-pointer"
								>
									<Plus size={14} />
									New transaction
								</button>
							</td>
						</tr>
						{sorted.length === 0 && (
							<tr>
								<td colSpan={colCount} className="py-6 text-center">
									<div className="flex flex-col items-center gap-2 text-base-content/40">
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
								</td>
							</tr>
						)}
						{sorted.map((txn) => (
							<tr key={txn.id.toString()}>
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
								{showAccountColumn && (
									<td className="text-sm text-base-content/50">
										{formatAccountLabel(txn, accounts, partitions)}
									</td>
								)}
								<td className="text-sm">
									{formatPartitionLabel(txn.sourcePartitionId, accounts, partitions)}
								</td>
								<td className="text-sm">
									{formatPartitionLabel(txn.destinationPartitionId, accounts, partitions)}
								</td>
								<td className="text-sm text-base-content/60 font-mono">
									{txn.serviceFeeCentavos !== 0n ? formatPesos(txn.serviceFeeCentavos) : ""}
								</td>
								<td className="text-sm text-base-content/60">{txn.description || "—"}</td>
								<td className="text-sm">{formatDate(txn.date)}</td>
								<td>
									<TransactionRowActions
										onEdit={() => onEdit(txn)}
										onDelete={() => onDelete(txn)}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
