import { Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { Tag } from "../../hooks/useTags";
import type { TransactionWithRecurring } from "../../hooks/useTransactions";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { Transaction } from "../../utils/transactionFilters";
import { TransactionRowActions } from "./TransactionRowActions";

type SortKey = "date" | "amount" | "type" | "tag" | "from" | "to";
type SortDir = "asc" | "desc";

type Props = {
	transactions: readonly TransactionWithRecurring[];
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
	onEdit: (tx: Transaction) => void;
	onChanged: () => Promise<void> | void;
	emptyCopy: string;
};

function cmp(a: string | number | null, b: string | number | null): number {
	if (a == null && b == null) return 0;
	if (a == null) return -1;
	if (b == null) return 1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b));
}

function typeBadge(type: Transaction["type"]) {
	if (type === "expense") return <span className="badge badge-sm badge-error">Expense</span>;
	if (type === "income") return <span className="badge badge-sm badge-success">Income</span>;
	return <span className="badge badge-sm badge-info">Transfer</span>;
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(new Date(`${iso}T12:00:00Z`));
}

export function TransactionsTable({
	transactions,
	accounts,
	tags,
	onEdit,
	onChanged,
	emptyCopy,
}: Props) {
	const [sortKey, setSortKey] = useState<SortKey>("date");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	const accountName = useMemo(() => {
		const m = new Map<string, string>();
		for (const a of accounts) m.set(a.id, a.name);
		return m;
	}, [accounts]);

	const tagName = useMemo(() => {
		const m = new Map<string, string>();
		for (const t of tags) m.set(t.id, t.name);
		return m;
	}, [tags]);

	const sorted = useMemo(() => {
		const copy = [...transactions];
		copy.sort((a, b) => {
			let result = 0;
			if (sortKey === "date") {
				result = cmp(a.date, b.date);
				if (result === 0) result = cmp(a.created_at, b.created_at);
			} else if (sortKey === "amount") {
				result = cmp(a.amount_centavos, b.amount_centavos);
			} else if (sortKey === "type") {
				result = cmp(a.type, b.type);
			} else if (sortKey === "tag") {
				result = cmp(
					a.tag_id ? (tagName.get(a.tag_id) ?? "") : "",
					b.tag_id ? (tagName.get(b.tag_id) ?? "") : "",
				);
			} else if (sortKey === "from") {
				result = cmp(
					a.from_account_id ? (accountName.get(a.from_account_id) ?? "") : "",
					b.from_account_id ? (accountName.get(b.from_account_id) ?? "") : "",
				);
			} else if (sortKey === "to") {
				result = cmp(
					a.to_account_id ? (accountName.get(a.to_account_id) ?? "") : "",
					b.to_account_id ? (accountName.get(b.to_account_id) ?? "") : "",
				);
			}
			return sortDir === "asc" ? result : -result;
		});
		return copy;
	}, [transactions, sortKey, sortDir, tagName, accountName]);

	function onHeaderClick(key: SortKey) {
		if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		else {
			setSortKey(key);
			setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
		}
	}

	if (sorted.length === 0) {
		return (
			<div className="rounded-box border border-dashed border-base-300 p-6 text-center text-base-content/60">
				{emptyCopy}
			</div>
		);
	}

	function headerArrow(key: SortKey) {
		if (key !== sortKey) return "";
		return sortDir === "asc" ? " ▲" : " ▼";
	}

	return (
		<div className="rounded-box border border-base-300">
			<div className="overflow-x-auto">
				<table className="table table-sm">
					<thead>
						<tr className="text-base-content/60">
							<th
								className="cursor-pointer select-none text-right whitespace-nowrap"
								onClick={() => onHeaderClick("amount")}
							>
								Amount{headerArrow("amount")}
							</th>
							<th
								className="cursor-pointer select-none whitespace-nowrap"
								onClick={() => onHeaderClick("type")}
							>
								Type{headerArrow("type")}
							</th>
							<th className="cursor-pointer select-none" onClick={() => onHeaderClick("tag")}>
								Tag{headerArrow("tag")}
							</th>
							<th className="cursor-pointer select-none" onClick={() => onHeaderClick("from")}>
								From{headerArrow("from")}
							</th>
							<th className="cursor-pointer select-none" onClick={() => onHeaderClick("to")}>
								To{headerArrow("to")}
							</th>
							<th className="text-right whitespace-nowrap hidden md:table-cell">Fee</th>
							<th className="hidden md:table-cell">Description</th>
							<th
								className="cursor-pointer select-none whitespace-nowrap"
								onClick={() => onHeaderClick("date")}
							>
								Date{headerArrow("date")}
							</th>
							<th className="w-12" />
						</tr>
					</thead>
					<tbody>
						{sorted.map((tx) => (
							<tr key={tx.id} className="hover:bg-base-200">
								<td className="text-right font-mono whitespace-nowrap">
									{formatCentavos(tx.amount_centavos)}
								</td>
								<td className="whitespace-nowrap">{typeBadge(tx.type)}</td>
								<td className="text-base-content/80 truncate max-w-[14ch]">
									{tx.tag_id ? (tagName.get(tx.tag_id) ?? "—") : "—"}
								</td>
								<td className="truncate max-w-[18ch]">
									{tx.from_account_id ? (accountName.get(tx.from_account_id) ?? "—") : "—"}
								</td>
								<td className="truncate max-w-[18ch]">
									{tx.to_account_id ? (accountName.get(tx.to_account_id) ?? "—") : "—"}
								</td>
								<td className="text-right font-mono text-base-content/60 whitespace-nowrap hidden md:table-cell">
									{tx.fee_centavos != null ? formatCentavos(tx.fee_centavos) : "—"}
								</td>
								<td className="text-base-content/70 max-w-[16rem] truncate hidden md:table-cell">
									<span className="inline-flex items-center gap-1.5">
										{tx.recurring_id != null && (
											<span
												className="tooltip tooltip-right shrink-0"
												data-tip={
													tx.recurring?.service
														? `From recurring: ${tx.recurring.service}`
														: "Auto-generated from a recurring"
												}
											>
												<Link
													to={`/recurring?id=${tx.recurring_id}`}
													className="inline-flex items-center hover:text-primary"
													onClick={(e) => e.stopPropagation()}
													aria-label="View source recurring"
												>
													<Repeat className="w-3.5 h-3.5 text-base-content/50" />
												</Link>
											</span>
										)}
										<span className="truncate">{tx.description ?? ""}</span>
									</span>
								</td>
								<td className="whitespace-nowrap">{formatDate(tx.date)}</td>
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation wrapper for the row-actions kebab. */}
								<td onClick={(e) => e.stopPropagation()}>
									<TransactionRowActions transaction={tx} onEdit={onEdit} onChanged={onChanged} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
