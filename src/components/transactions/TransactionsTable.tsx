import { Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { Tag } from "../../hooks/useTags";
import type { TransactionWithRecurring } from "../../hooks/useTransactions";
import { useAuth } from "../../providers/AuthProvider";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import { formatTransactionDate } from "../../utils/transactionDateFormat";
import type { Transaction } from "../../utils/transactionFilters";
import { TransactionAccountCell } from "./TransactionAccountCell";
import { TransactionAmountCell } from "./TransactionAmountCell";
import { TransactionRowActions } from "./TransactionRowActions";

type SortKey = "date" | "amount" | "tag" | "account";
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

function accountSortKey(tx: Transaction, lookup: ReadonlyMap<string, string>): string {
	if (tx.type === "expense")
		return tx.from_account_id ? (lookup.get(tx.from_account_id) ?? "") : "";
	if (tx.type === "income") return tx.to_account_id ? (lookup.get(tx.to_account_id) ?? "") : "";
	const from = tx.from_account_id ? (lookup.get(tx.from_account_id) ?? "") : "";
	const to = tx.to_account_id ? (lookup.get(tx.to_account_id) ?? "") : "";
	return `${from} → ${to}`;
}

export function TransactionsTable({
	transactions,
	accounts,
	tags,
	onEdit,
	onChanged,
	emptyCopy,
}: Props) {
	const { profile } = useAuth();
	const timezone = profile?.timezone ?? "Asia/Manila";
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
			} else if (sortKey === "tag") {
				result = cmp(
					a.tag_id ? (tagName.get(a.tag_id) ?? "") : "",
					b.tag_id ? (tagName.get(b.tag_id) ?? "") : "",
				);
			} else if (sortKey === "account") {
				result = cmp(accountSortKey(a, accountName), accountSortKey(b, accountName));
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

	const today = new Date();

	return (
		<div className="rounded-box border border-base-300">
			<div className="overflow-x-auto">
				<table className="table table-sm">
					<thead>
						<tr className="text-base-content/60">
							<th
								className="cursor-pointer select-none whitespace-nowrap"
								onClick={() => onHeaderClick("date")}
							>
								Date{headerArrow("date")}
							</th>
							<th className="cursor-pointer select-none" onClick={() => onHeaderClick("tag")}>
								Tag{headerArrow("tag")}
							</th>
							<th
								className="cursor-pointer select-none text-right whitespace-nowrap"
								onClick={() => onHeaderClick("amount")}
							>
								Amount{headerArrow("amount")}
							</th>
							<th className="cursor-pointer select-none" onClick={() => onHeaderClick("account")}>
								Account{headerArrow("account")}
							</th>
							<th className="hidden md:table-cell">Description</th>
							<th className="w-12" />
						</tr>
					</thead>
					<tbody>
						{sorted.map((tx) => (
							<tr key={tx.id} className="hover:bg-base-200">
								<td className="whitespace-nowrap tabular-nums text-base-content/80">
									{formatTransactionDate(tx.date, today, timezone)}
								</td>
								<td className="text-base-content/80 truncate max-w-[14ch]">
									{tx.tag_id ? (tagName.get(tx.tag_id) ?? "—") : "—"}
								</td>
								<td className="text-right whitespace-nowrap">
									<TransactionAmountCell
										type={tx.type}
										amountCentavos={tx.amount_centavos}
										feeCentavos={tx.fee_centavos}
									/>
								</td>
								<td className="truncate max-w-[28ch]">
									<TransactionAccountCell
										type={tx.type}
										fromAccountId={tx.from_account_id}
										toAccountId={tx.to_account_id}
										accountsById={accountName}
									/>
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
