import { useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

export interface TransactionFilters {
	type: "" | "expense" | "income" | "transfer";
	tag: string;
	dateFrom: string;
	dateTo: string;
	accountPartition?: string;
}

interface TransactionFilterRowProps {
	filters: TransactionFilters;
	onChange: (filters: TransactionFilters) => void;
	accounts?: readonly { id: bigint; name: string }[];
	subAccounts?: readonly { id: bigint; accountId: bigint; name: string; isDefault: boolean }[];
}

const TAGS = [
	"foods",
	"grocery",
	"transportation",
	"online-shopping",
	"gadgets",
	"bills",
	"pets",
	"personal-care",
	"health",
	"monthly-salary",
	"digital-subscriptions",
	"entertainment",
	"clothing",
	"education",
	"travel",
	"housing",
	"insurance",
	"gifts",
	"freelance",
	"interest",
	"bonus",
] as const;

function toDateString(date: Date | undefined): string {
	if (!date) return "";
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function fromDateString(str: string): Date | undefined {
	if (!str) return undefined;
	const [year, month, day] = str.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function formatRangeLabel(dateFrom: string, dateTo: string): string {
	if (!dateFrom && !dateTo) return "All dates";
	const fmt = (s: string) =>
		new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
	if (dateFrom) return `From ${fmt(dateFrom)}`;
	return `Until ${fmt(dateTo)}`;
}

export function TransactionFilterRow({
	filters,
	onChange,
	accounts,
	subAccounts,
}: TransactionFilterRowProps) {
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const popoverRef = useRef<HTMLDivElement>(null);

	const selected: DateRange = {
		from: fromDateString(filters.dateFrom),
		to: fromDateString(filters.dateTo),
	};

	const activeCount = [
		filters.type,
		filters.tag,
		filters.dateFrom || filters.dateTo ? "date" : "",
		filters.accountPartition ? "account" : "",
	].filter(Boolean).length;

	function handleRangeSelect(range: DateRange | undefined) {
		onChange({
			...filters,
			dateFrom: toDateString(range?.from),
			dateTo: toDateString(range?.to),
		});
	}

	function clearDates() {
		onChange({ ...filters, dateFrom: "", dateTo: "" });
	}

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		function handle(e: MouseEvent) {
			if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, [open]);

	return (
		<>
			{/* Mobile toggle button - visible below sm only */}
			<button
				type="button"
				className="btn btn-sm btn-ghost gap-1 sm:hidden"
				onClick={() => setExpanded((v) => !v)}
			>
				Filter
				{activeCount > 0 && <span className="badge badge-sm">{activeCount}</span>}
			</button>

			{/* Filter inputs - conditionally visible on mobile, always visible on sm+ */}
			<div
				className={`${expanded ? "flex" : "hidden"} sm:flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap mt-2 sm:mt-0`}
			>
				{/* Account / partition filter */}
				{accounts && subAccounts && (
					<select
						className="select select-bordered select-sm w-full sm:w-auto"
						value={filters.accountPartition ?? ""}
						onChange={(e) =>
							onChange({ ...filters, accountPartition: e.target.value || undefined })
						}
					>
						<option value="">All accounts</option>
						{accounts.map((acct) => {
							const acctSubAccounts = subAccounts.filter(
								(p) => p.accountId === acct.id && !p.isDefault,
							);
							if (acctSubAccounts.length === 0) {
								return (
									<option key={`a-${acct.id}`} value={`account:${acct.id}`}>
										{acct.name}
									</option>
								);
							}
							return (
								<optgroup key={`g-${acct.id}`} label={acct.name}>
									<option value={`account:${acct.id}`}>All {acct.name}</option>
									{acctSubAccounts.map((p) => (
										<option key={`p-${p.id}`} value={`partition:${p.id}`}>
											{acct.name} / {p.name}
										</option>
									))}
								</optgroup>
							);
						})}
					</select>
				)}

				{/* Type filter */}
				<select
					className="select select-bordered select-sm w-full sm:w-auto"
					value={filters.type}
					onChange={(e) =>
						onChange({
							...filters,
							type: e.target.value as TransactionFilters["type"],
						})
					}
				>
					<option value="">All types</option>
					<option value="expense">Expense</option>
					<option value="income">Income</option>
					<option value="transfer">Transfer</option>
				</select>

				{/* Tag filter */}
				<select
					className="select select-bordered select-sm w-full sm:w-auto"
					value={filters.tag}
					onChange={(e) => onChange({ ...filters, tag: e.target.value })}
				>
					<option value="">All tags</option>
					{TAGS.map((tag) => (
						<option key={tag} value={tag}>
							{tag}
						</option>
					))}
				</select>

				{/* Date range picker */}
				<div className="relative" ref={popoverRef}>
					<div className="flex items-center gap-1">
						<button
							type="button"
							className="select select-bordered select-sm w-full sm:w-auto flex items-center gap-1"
							onClick={() => setOpen((v) => !v)}
						>
							{formatRangeLabel(filters.dateFrom, filters.dateTo)}
						</button>
						{(filters.dateFrom || filters.dateTo) && (
							<button
								type="button"
								className="btn btn-ghost btn-sm btn-square"
								onClick={clearDates}
								aria-label="Clear date range"
							>
								✕
							</button>
						)}
					</div>
					{open && (
						<div className="absolute top-full mt-1 z-50 bg-base-100 border border-base-300/50 rounded-xl shadow-lg p-2">
							<DayPicker
								mode="range"
								selected={selected}
								onSelect={handleRangeSelect}
								captionLayout="dropdown"
							/>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
