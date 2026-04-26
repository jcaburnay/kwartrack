import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import {
	DEFAULT_RECURRING_FILTERS,
	type RecurringFilters,
	type RecurringStatus,
} from "../../utils/recurringFilters";
import type { RecurringInterval } from "../../utils/recurringValidation";
import type { TransactionType } from "../../utils/transactionValidation";

type Props = {
	filters: RecurringFilters;
	onChange: (next: RecurringFilters) => void;
	accounts: readonly Account[];
	tags: readonly Tag[];
};

const TYPES: { value: TransactionType; label: string }[] = [
	{ value: "expense", label: "Expense" },
	{ value: "income", label: "Income" },
	{ value: "transfer", label: "Transfer" },
];

const INTERVALS: { value: RecurringInterval; label: string }[] = [
	{ value: "weekly", label: "Weekly" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "semi_annual", label: "Semi-annual" },
	{ value: "annual", label: "Annual" },
];

const STATUSES: { value: RecurringStatus; label: string }[] = [
	{ value: "active", label: "Active" },
	{ value: "paused", label: "Paused" },
	{ value: "completed", label: "Completed" },
];

function toggleStatus(
	set: ReadonlySet<RecurringStatus>,
	value: RecurringStatus,
): Set<RecurringStatus> {
	const next = new Set(set);
	if (next.has(value)) next.delete(value);
	else next.add(value);
	return next;
}

export function RecurringFilterBar({ filters, onChange, accounts, tags }: Props) {
	const visibleAccounts = accounts.filter((a) => !a.is_archived);
	const userTags = tags.filter((t) => !t.is_system);

	return (
		<div className="flex flex-wrap items-end gap-3 py-1">
			<div className="form-control">
				<div className="label py-0">
					<span className="label-text-alt">Status</span>
				</div>
				<div className="flex gap-2">
					{STATUSES.map((s) => (
						<label key={s.value} className="label cursor-pointer gap-1 py-0">
							<input
								type="checkbox"
								className="checkbox checkbox-xs"
								checked={filters.statuses.has(s.value)}
								onChange={() =>
									onChange({ ...filters, statuses: toggleStatus(filters.statuses, s.value) })
								}
							/>
							<span className="label-text-alt">{s.label}</span>
						</label>
					))}
				</div>
			</div>

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
					<span className="label-text-alt">Interval</span>
				</div>
				<select
					className="select select-bordered select-sm"
					value={filters.interval ?? ""}
					onChange={(e) =>
						onChange({ ...filters, interval: (e.target.value || null) as RecurringInterval | null })
					}
				>
					<option value="">All</option>
					{INTERVALS.map((iv) => (
						<option key={iv.value} value={iv.value}>
							{iv.label}
						</option>
					))}
				</select>
			</label>

			<label className="form-control flex-1 min-w-[10rem]">
				<div className="label py-0">
					<span className="label-text-alt">Search</span>
				</div>
				<input
					type="search"
					className="input input-bordered input-sm"
					placeholder="Service name…"
					value={filters.search}
					onChange={(e) => onChange({ ...filters, search: e.target.value })}
				/>
			</label>

			<button
				type="button"
				className="btn btn-ghost btn-sm"
				onClick={() => onChange(DEFAULT_RECURRING_FILTERS)}
			>
				Reset
			</button>
		</div>
	);
}
