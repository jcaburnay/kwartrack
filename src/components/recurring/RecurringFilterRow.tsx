import type { Tag } from "../../hooks/useTags";
import {
	DEFAULT_RECURRING_FILTERS,
	type RecurringFilters,
	type RecurringStatus,
} from "../../utils/recurringFilters";
import type { RecurringInterval } from "../../utils/recurringValidation";
import type { TransactionType } from "../../utils/transactionValidation";
import { DropdownSelect } from "../ui/DropdownSelect";
import { PillToggle } from "../ui/PillToggle";

type Props = {
	filters: RecurringFilters;
	onChange: (next: RecurringFilters) => void;
	tags: readonly Tag[];
};

const TYPE_PILLS: { value: TransactionType | null; label: string }[] = [
	{ value: null, label: "All types" },
	{ value: "expense", label: "Expenses" },
	{ value: "income", label: "Income" },
	{ value: "transfer", label: "Transfers" },
];

const CADENCE_OPTIONS: { value: RecurringInterval | "all"; label: string }[] = [
	{ value: "all", label: "Cadence: All" },
	{ value: "weekly", label: "Cadence: Weekly" },
	{ value: "monthly", label: "Cadence: Monthly" },
	{ value: "quarterly", label: "Cadence: Quarterly" },
	{ value: "semi_annual", label: "Cadence: Semi-annual" },
	{ value: "annual", label: "Cadence: Annual" },
];

function isDefault(f: RecurringFilters): boolean {
	const d = DEFAULT_RECURRING_FILTERS;
	if (f.type !== d.type) return false;
	if (f.accountId !== d.accountId) return false;
	if (f.tagId !== d.tagId) return false;
	if (f.interval !== d.interval) return false;
	if (f.search !== d.search) return false;
	if (f.statuses.size !== d.statuses.size) return false;
	for (const s of d.statuses) if (!f.statuses.has(s)) return false;
	return true;
}

function withStatusToggle(
	f: RecurringFilters,
	status: RecurringStatus,
	on: boolean,
): RecurringFilters {
	const next = new Set(f.statuses);
	if (on) next.add(status);
	else next.delete(status);
	return { ...f, statuses: next };
}

export function RecurringFilterRow({ filters, onChange, tags }: Props) {
	const userTags = tags.filter((t) => !t.is_system);
	const showCompleted = filters.statuses.has("completed");

	const tagOptions = [
		{ value: "all", label: "Tag: All" },
		...userTags.map((t) => ({ value: t.id, label: `Tag: ${t.name}` })),
	];

	return (
		<div className="flex flex-wrap items-center gap-2 py-1">
			<PillToggle
				ariaLabel="Filter by type"
				value={filters.type}
				options={TYPE_PILLS}
				onChange={(next) => onChange({ ...filters, type: next })}
			/>

			<DropdownSelect
				ariaLabel="Filter by tag"
				value={filters.tagId ?? "all"}
				options={tagOptions}
				onChange={(v) => onChange({ ...filters, tagId: v === "all" ? null : v })}
			/>

			<DropdownSelect
				ariaLabel="Filter by cadence"
				value={filters.interval ?? "all"}
				options={CADENCE_OPTIONS}
				onChange={(v) =>
					onChange({ ...filters, interval: v === "all" ? null : (v as RecurringInterval) })
				}
			/>

			<input
				type="search"
				className="input input-sm rounded-sm border-base-content/40 w-40"
				placeholder="Search service…"
				value={filters.search}
				onChange={(e) => onChange({ ...filters, search: e.target.value })}
			/>

			<label className="label cursor-pointer gap-2 py-0">
				<input
					type="checkbox"
					aria-label="Show completed"
					className="checkbox checkbox-xs"
					checked={showCompleted}
					onChange={(e) => onChange(withStatusToggle(filters, "completed", e.target.checked))}
				/>
				<span className="label-text-alt">Show completed</span>
			</label>

			{!isDefault(filters) && (
				<button
					type="button"
					className="btn btn-ghost btn-sm rounded-sm border-base-content/40 ml-auto"
					onClick={() => onChange(DEFAULT_RECURRING_FILTERS)}
					aria-label="Clear filters"
				>
					Clear
				</button>
			)}
		</div>
	);
}
