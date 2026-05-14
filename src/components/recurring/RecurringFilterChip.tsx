import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Tag } from "../../hooks/useTags";
import {
	DEFAULT_RECURRING_FILTERS,
	type RecurringFilters,
	type RecurringStatus,
} from "../../utils/recurringFilters";
import type { RecurringInterval } from "../../utils/recurringValidation";
import type { TransactionType } from "../../utils/transactionValidation";
import { Modal } from "../ui/Modal";
import { PillToggle } from "../ui/PillToggle";

type Props = {
	filters: RecurringFilters;
	onChange: (next: RecurringFilters) => void;
	tags: readonly Tag[];
};

const TYPE_PILLS: { value: TransactionType | null; label: string }[] = [
	{ value: null, label: "All" },
	{ value: "expense", label: "Expenses" },
	{ value: "income", label: "Income" },
	{ value: "transfer", label: "Transfers" },
];

const CADENCE_OPTIONS: { value: RecurringInterval | "all"; label: string }[] = [
	{ value: "all", label: "All cadences" },
	{ value: "weekly", label: "Weekly" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
	{ value: "semi_annual", label: "Semi-annual" },
	{ value: "annual", label: "Annual" },
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

function activeFilterCount(f: RecurringFilters): number {
	let n = 0;
	if (f.type != null) n++;
	if (f.tagId != null) n++;
	if (f.interval != null) n++;
	if (f.search.trim().length > 0) n++;
	if (f.statuses.has("completed")) n++;
	return n;
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

export function RecurringFilterChip({ filters, onChange, tags }: Props) {
	const userTags = tags.filter((t) => !t.is_system);
	const [open, setOpen] = useState(false);

	const count = activeFilterCount(filters);
	const isFiltered = count > 0;
	const showCompleted = filters.statuses.has("completed");

	return (
		<>
			<button
				type="button"
				className="btn btn-sm btn-ghost rounded-sm border border-base-content/40 gap-1.5"
				aria-label={isFiltered ? `Filters (${count} active)` : "Filters"}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen(true)}
			>
				<SlidersHorizontal className="size-4" />
				<span>Filter</span>
				{isFiltered && <span className="badge badge-primary badge-xs tabular-nums">{count}</span>}
			</button>

			{open && (
				<Modal onClose={() => setOpen(false)} size="md">
					<Modal.Header title="Filter recurrings" />
					<Modal.Body>
						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-base-content/60">Type</span>
							<PillToggle
								ariaLabel="Filter by type"
								value={filters.type}
								options={TYPE_PILLS}
								onChange={(next) => onChange({ ...filters, type: next })}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								className="text-xs font-medium text-base-content/60"
								htmlFor="recurring-chip-tag"
							>
								Tag
							</label>
							<select
								id="recurring-chip-tag"
								className="select select-bordered select-sm rounded-sm border-base-content/40 w-full"
								value={filters.tagId ?? ""}
								onChange={(e) => onChange({ ...filters, tagId: e.target.value || null })}
							>
								<option value="">All tags</option>
								{userTags.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
							</select>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								className="text-xs font-medium text-base-content/60"
								htmlFor="recurring-chip-cadence"
							>
								Cadence
							</label>
							<select
								id="recurring-chip-cadence"
								className="select select-bordered select-sm rounded-sm border-base-content/40 w-full"
								value={filters.interval ?? "all"}
								onChange={(e) => {
									const v = e.target.value;
									onChange({
										...filters,
										interval: v === "all" ? null : (v as RecurringInterval),
									});
								}}
							>
								{CADENCE_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								className="text-xs font-medium text-base-content/60"
								htmlFor="recurring-chip-search"
							>
								Search
							</label>
							<input
								id="recurring-chip-search"
								type="search"
								className="input input-bordered input-sm rounded-sm border-base-content/40 w-full"
								placeholder="Service name…"
								value={filters.search}
								onChange={(e) => onChange({ ...filters, search: e.target.value })}
							/>
						</div>

						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								className="checkbox checkbox-sm"
								checked={showCompleted}
								onChange={(e) => onChange(withStatusToggle(filters, "completed", e.target.checked))}
							/>
							<span className="text-sm">Show completed</span>
						</label>
					</Modal.Body>
					<Modal.Footer>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => onChange(DEFAULT_RECURRING_FILTERS)}
							disabled={isDefault(filters)}
						>
							Clear all
						</button>
						<button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
							Done
						</button>
					</Modal.Footer>
				</Modal>
			)}
		</>
	);
}
