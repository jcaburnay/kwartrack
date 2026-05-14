import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Tag } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { resolveDateRangePreset } from "../../utils/transactionDateRange";
import { EMPTY_FILTERS, type TransactionFilters } from "../../utils/transactionFilters";
import type { TransactionType } from "../../utils/transactionValidation";
import { Modal } from "../ui/Modal";
import { PillToggle } from "../ui/PillToggle";
import { DateRangePicker, type DateRangeValue } from "./DateRangePicker";

type Props = {
	filters: TransactionFilters;
	dateRange: DateRangeValue;
	search: string;
	onChange: (next: TransactionFilters) => void;
	onDateRangeChange: (next: DateRangeValue) => void;
	onSearchChange: (next: string) => void;
	tags: readonly Tag[];
};

const TYPE_PILLS: { value: TransactionType | null; label: string }[] = [
	{ value: null, label: "All" },
	{ value: "expense", label: "Expenses" },
	{ value: "income", label: "Income" },
	{ value: "transfer", label: "Transfers" },
];

function activeFilterCount(
	filters: TransactionFilters,
	dateRange: DateRangeValue,
	search: string,
): number {
	let n = 0;
	if (filters.type != null) n++;
	if (filters.tagId != null) n++;
	if (dateRange.preset !== "all-time") n++;
	if (search.trim().length > 0) n++;
	return n;
}

export function TransactionFilterChip({
	filters,
	dateRange,
	search,
	onChange,
	onDateRangeChange,
	onSearchChange,
	tags,
}: Props) {
	const { profile } = useAuth();
	const timezone = profile?.timezone ?? "Asia/Manila";
	const userTags = tags.filter((t) => !t.is_system);
	const [open, setOpen] = useState(false);

	const count = activeFilterCount(filters, dateRange, search);
	const isFiltered = count > 0;

	function pickType(value: TransactionType | null) {
		onChange({ ...filters, type: value });
	}

	function pickDateRange(next: DateRangeValue) {
		onDateRangeChange(next);
		const resolved =
			next.preset === "custom"
				? { from: next.customFrom, to: next.customTo }
				: resolveDateRangePreset(next.preset, timezone);
		onChange({ ...filters, dateFrom: resolved.from, dateTo: resolved.to });
	}

	function clearAll() {
		onChange({
			...EMPTY_FILTERS,
			splitId: filters.splitId,
			debtId: filters.debtId,
		});
		onDateRangeChange({ preset: "all-time", customFrom: null, customTo: null });
		onSearchChange("");
	}

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
					<Modal.Header title="Filter transactions" />
					<Modal.Body>
						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-base-content/60">Type</span>
							<PillToggle
								ariaLabel="Filter by type"
								value={filters.type}
								options={TYPE_PILLS}
								onChange={pickType}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-xs font-medium text-base-content/60" htmlFor="filter-chip-tag">
								Tag
							</label>
							<select
								id="filter-chip-tag"
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
							<span className="text-xs font-medium text-base-content/60">Date range</span>
							<DateRangePicker
								preset={dateRange.preset}
								customFrom={dateRange.customFrom}
								customTo={dateRange.customTo}
								onChange={pickDateRange}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							<label
								className="text-xs font-medium text-base-content/60"
								htmlFor="filter-chip-search"
							>
								Search
							</label>
							<input
								id="filter-chip-search"
								type="search"
								className="input input-bordered input-sm rounded-sm border-base-content/40 w-full"
								placeholder="Description, tag, account…"
								value={search}
								onChange={(e) => onSearchChange(e.target.value)}
							/>
						</div>
					</Modal.Body>
					<Modal.Footer>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={clearAll}
							disabled={!isFiltered}
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
