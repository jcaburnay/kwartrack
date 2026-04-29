import type { Tag } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { resolveDateRangePreset } from "../../utils/transactionDateRange";
import { EMPTY_FILTERS, type TransactionFilters } from "../../utils/transactionFilters";
import type { TransactionType } from "../../utils/transactionValidation";
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

export function TransactionFilterBar({
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

	const isFiltered =
		filters.type != null ||
		filters.tagId != null ||
		dateRange.preset !== "all-time" ||
		search.trim().length > 0;

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
		<div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-base-300">
			<div className="join">
				{TYPE_PILLS.map((p) => (
					<button
						key={p.label}
						type="button"
						className={`btn btn-sm join-item ${filters.type === p.value ? "btn-primary" : "btn-ghost"}`}
						onClick={() => pickType(p.value)}
					>
						{p.label}
					</button>
				))}
			</div>

			<select
				aria-label="Tag filter"
				className="select select-bordered select-sm min-w-0 w-auto focus:outline-none"
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

			<DateRangePicker
				preset={dateRange.preset}
				customFrom={dateRange.customFrom}
				customTo={dateRange.customTo}
				onChange={pickDateRange}
			/>

			<input
				type="search"
				className="input input-bordered input-sm flex-1 min-w-[12ch] max-w-[24ch]"
				placeholder="Search description, tag, account…"
				value={search}
				onChange={(e) => onSearchChange(e.target.value)}
			/>

			{isFiltered && (
				<button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
					Clear
				</button>
			)}
		</div>
	);
}
