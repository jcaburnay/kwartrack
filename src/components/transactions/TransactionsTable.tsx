import { Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useContainerNarrow } from "../../hooks/useContainerNarrow";
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

// Below this container width we switch from the data table to a card list —
// horizontal scrolling on small panels (mobile, narrow tablet column) is the
// dominant pain point this component is paid to fix.
const CARD_MAX_WIDTH = 520;

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

	const { ref: containerRef, isNarrow } = useContainerNarrow<HTMLDivElement>(CARD_MAX_WIDTH);

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
			<div ref={containerRef}>
				<div className="border border-dashed border-base-300 p-6 text-center text-base-content/60">
					{emptyCopy}
				</div>
			</div>
		);
	}

	function headerArrow(key: SortKey) {
		if (key !== sortKey) return "";
		return sortDir === "asc" ? " ▲" : " ▼";
	}

	const today = new Date();

	return (
		<div ref={containerRef}>
			{isNarrow ? (
				<div className="flex flex-col">
					<CardSortBar
						count={sorted.length}
						sortKey={sortKey}
						sortDir={sortDir}
						onChange={(key, dir) => {
							setSortKey(key);
							setSortDir(dir);
						}}
					/>
					<ul className="flex flex-col divide-y divide-base-200">
						{sorted.map((tx) => (
							<TransactionCard
								key={tx.id}
								tx={tx}
								accountName={accountName}
								tagName={tagName}
								timezone={timezone}
								today={today}
								onEdit={onEdit}
								onChanged={onChanged}
							/>
						))}
					</ul>
				</div>
			) : (
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
														to={`/?modal=edit-recurring&id=${tx.recurring_id}`}
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
			)}
		</div>
	);
}

type CardSortBarProps = {
	count: number;
	sortKey: SortKey;
	sortDir: SortDir;
	onChange: (key: SortKey, dir: SortDir) => void;
};

const SORT_OPTIONS: { value: string; label: string }[] = [
	{ value: "date-desc", label: "Newest first" },
	{ value: "date-asc", label: "Oldest first" },
	{ value: "amount-desc", label: "Amount, high → low" },
	{ value: "amount-asc", label: "Amount, low → high" },
	{ value: "tag-asc", label: "Tag (A → Z)" },
	{ value: "account-asc", label: "Account (A → Z)" },
];

function CardSortBar({ count, sortKey, sortDir, onChange }: CardSortBarProps) {
	const value = `${sortKey}-${sortDir}`;
	return (
		<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-base-200 text-xs text-base-content/60">
			<span className="tabular-nums">
				{count} {count === 1 ? "transaction" : "transactions"}
			</span>
			<label className="flex items-center gap-1.5">
				<span className="sr-only">Sort by</span>
				<select
					value={value}
					onChange={(e) => {
						const [key, dir] = e.target.value.split("-") as [SortKey, SortDir];
						onChange(key, dir);
					}}
					className="select select-bordered select-xs rounded-sm border-base-content/30"
				>
					{SORT_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}

type CardProps = {
	tx: TransactionWithRecurring;
	accountName: ReadonlyMap<string, string>;
	tagName: ReadonlyMap<string, string>;
	timezone: string;
	today: Date;
	onEdit: (tx: Transaction) => void;
	onChanged: () => Promise<void> | void;
};

function TransactionCard({
	tx,
	accountName,
	tagName,
	timezone,
	today,
	onEdit,
	onChanged,
}: CardProps) {
	const tagLabel = tx.tag_id ? (tagName.get(tx.tag_id) ?? "—") : "—";
	return (
		<li className="relative px-3 py-2.5 hover:bg-base-200 active:bg-base-200 flex flex-col gap-1">
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-1.5 min-w-0 flex-1 pt-0.5">
					{tx.recurring_id != null && (
						<span
							className="tooltip shrink-0"
							data-tip={
								tx.recurring?.service
									? `From recurring: ${tx.recurring.service}`
									: "Auto-generated from a recurring"
							}
						>
							<Link
								to={`/?modal=edit-recurring&id=${tx.recurring_id}`}
								className="inline-flex items-center text-base-content/50 hover:text-primary"
								onClick={(e) => e.stopPropagation()}
								aria-label="View source recurring"
							>
								<Repeat className="w-3.5 h-3.5" />
							</Link>
						</span>
					)}
					<span className="text-xs font-medium uppercase tracking-wide text-base-content/70 truncate">
						{tagLabel}
					</span>
				</div>
				<TransactionAmountCell
					type={tx.type}
					amountCentavos={tx.amount_centavos}
					feeCentavos={tx.fee_centavos}
				/>
			</div>
			<div className="flex items-center justify-between gap-2 text-xs text-base-content/60">
				<div className="flex items-center gap-1.5 min-w-0 flex-1">
					<span className="truncate min-w-0">
						<TransactionAccountCell
							type={tx.type}
							fromAccountId={tx.from_account_id}
							toAccountId={tx.to_account_id}
							accountsById={accountName}
						/>
					</span>
					<span className="text-base-content/30 shrink-0">·</span>
					<span className="tabular-nums shrink-0">
						{formatTransactionDate(tx.date, today, timezone)}
					</span>
				</div>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation wrapper for the row-actions kebab. */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for the row-actions kebab. */}
				<div className="shrink-0 -mr-1" onClick={(e) => e.stopPropagation()}>
					<TransactionRowActions transaction={tx} onEdit={onEdit} onChanged={onChanged} />
				</div>
			</div>
			{tx.description && (
				<p className="text-xs text-base-content/70 line-clamp-2 break-words">{tx.description}</p>
			)}
		</li>
	);
}
