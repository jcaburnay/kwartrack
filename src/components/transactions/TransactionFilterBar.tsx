import type { Tag } from "../../hooks/useTags";
import type { Account, AccountGroup } from "../../utils/accountBalances";
import { EMPTY_FILTERS, type TransactionFilters } from "../../utils/transactionFilters";
import type { TransactionType } from "../../utils/transactionValidation";

type Props = {
	filters: TransactionFilters;
	onChange: (next: TransactionFilters) => void;
	accounts: readonly Account[];
	groups: readonly AccountGroup[];
	tags: readonly Tag[];
};

const TYPES: { value: TransactionType; label: string }[] = [
	{ value: "expense", label: "Expense" },
	{ value: "income", label: "Income" },
	{ value: "transfer", label: "Transfer" },
];

export function TransactionFilterBar({ filters, onChange, accounts, groups, tags }: Props) {
	const visibleAccounts = accounts.filter((a) => !a.is_archived);
	const userTags = tags.filter((t) => !t.is_system);
	const isEmpty = JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS);

	return (
		<div className="flex flex-wrap items-end gap-2 py-1">
			<label className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">Type</span>
				</div>
				<select
					className="select select-bordered select-sm"
					value={filters.type ?? ""}
					onChange={(e) =>
						onChange({ ...filters, type: (e.target.value || null) as TransactionType | null })
					}
				>
					<option value="">All</option>
					{TYPES.map((t) => (
						<option key={t.value} value={t.value}>
							{t.label}
						</option>
					))}
				</select>
			</label>

			<label className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">Tag</span>
				</div>
				<select
					className="select select-bordered select-sm"
					value={filters.tagId ?? ""}
					onChange={(e) => onChange({ ...filters, tagId: e.target.value || null })}
				>
					<option value="">All</option>
					{userTags.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
			</label>

			<label className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">Group</span>
				</div>
				<select
					className="select select-bordered select-sm"
					value={filters.groupId ?? ""}
					onChange={(e) => onChange({ ...filters, groupId: e.target.value || null })}
				>
					<option value="">All</option>
					{groups.map((g) => (
						<option key={g.id} value={g.id}>
							{g.name}
						</option>
					))}
				</select>
			</label>

			<label className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">Account</span>
				</div>
				<select
					className="select select-bordered select-sm"
					value={filters.accountId ?? ""}
					onChange={(e) => onChange({ ...filters, accountId: e.target.value || null })}
				>
					<option value="">All</option>
					{visibleAccounts.map((a) => (
						<option key={a.id} value={a.id}>
							{a.name}
						</option>
					))}
				</select>
			</label>

			<label className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">From date</span>
				</div>
				<input
					type="date"
					className="input input-bordered input-sm"
					value={filters.dateFrom ?? ""}
					onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
				/>
			</label>

			<label className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">To date</span>
				</div>
				<input
					type="date"
					className="input input-bordered input-sm"
					value={filters.dateTo ?? ""}
					onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
				/>
			</label>

			{!isEmpty && (
				<button
					type="button"
					className="btn btn-ghost btn-sm"
					onClick={() => onChange(EMPTY_FILTERS)}
				>
					Clear
				</button>
			)}
		</div>
	);
}
