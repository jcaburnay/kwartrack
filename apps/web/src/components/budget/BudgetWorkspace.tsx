import { useEffect, useState } from "react";
import { useBudget } from "../../hooks/useBudget";
import { useBudgetPeriodHistory } from "../../hooks/useBudgetPeriodHistory";
import { type BudgetPeriod, useBudgetPeriods, useTodayISO } from "../../hooks/useBudgetPeriods";
import { usePersistedOption } from "../../hooks/usePersistedOption";
import { useTags } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { activeBudgetPeriod, type BudgetDateRange, periodLabel } from "../../utils/budgetPeriod";
import { shiftDaysISO } from "../../utils/dateRange";
import { PillToggle } from "../ui/PillToggle";
import { SubmitButton } from "../ui/SubmitButton";
import { BudgetAnchor } from "./BudgetAnchor";
import { BudgetPeriodModal } from "./BudgetPeriodModal";
import { BudgetTableView } from "./BudgetTableView";
import { BudgetTagHistoryView, OVERALL_VALUE } from "./BudgetTagHistoryView";
import { type BudgetView, BudgetViewSelector } from "./BudgetViewSelector";

type Props = { onDrillToTag?: (tagId: string, range: BudgetDateRange) => void };
const VIEWS: BudgetView[] = ["table", "history"];
const COUNTS = ["3", "6", "12", "all"];
const COUNT_OPTIONS = COUNTS.map((value) => ({
	value,
	label: value === "all" ? "All" : `${value} periods`,
}));

export function BudgetWorkspace({ onDrillToTag }: Props = {}) {
	const { profile } = useAuth();
	const timezone = profile?.timezone ?? "Asia/Manila";
	const todayISO = useTodayISO(timezone);
	const today = new Date();
	const {
		periods,
		isLoading: periodsLoading,
		error: periodsError,
		savePeriod,
	} = useBudgetPeriods();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const active = activeBudgetPeriod(periods, todayISO);
	const selected =
		selectedId === null ? active : (periods.find((p) => p.id === selectedId) ?? null);
	const [modal, setModal] = useState<"new" | BudgetPeriod | null>(null);
	const [copyError, setCopyError] = useState<string | null>(null);
	const [copying, setCopying] = useState(false);
	const [view, setView] = usePersistedOption<BudgetView>("kwartrack:budgetView", "table", VIEWS);
	const [count, setCount] = usePersistedOption("kwartrack:budgetPeriodCount", "12", COUNTS);
	const [historyTagId, setHistoryTagId] = usePersistedOption<string>(
		"kwartrack:budgetHistoryTag",
		OVERALL_VALUE,
	);
	const { tags, isLoading: tagsLoading } = useTags();
	const budget = useBudget(selected);
	useEffect(() => {
		if (!tagsLoading && historyTagId !== OVERALL_VALUE && !tags.some((t) => t.id === historyTagId))
			setHistoryTagId(OVERALL_VALUE);
	}, [tagsLoading, tags, historyTagId, setHistoryTagId]);
	const historyPeriods = periods.filter((p) => !selected || p.start_date <= selected.start_date);
	const visiblePeriods = (
		count === "all" ? historyPeriods : historyPeriods.slice(0, Number(count))
	).toReversed();
	const history = useBudgetPeriodHistory(view === "history" ? visiblePeriods : []);
	const previous = selected ? periods.find((p) => p.end_date < selected.start_date) : null;
	const allocated = budget.allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const error =
		periodsError ?? budget.error ?? (view === "history" ? history.error : null) ?? copyError;
	async function copyPrevious() {
		if (!previous) return;
		setCopying(true);
		setCopyError(null);
		try {
			setCopyError(await budget.copyFromPeriod(previous.id));
		} catch {
			setCopyError("Could not copy that budget. Please try again.");
		} finally {
			setCopying(false);
		}
	}
	return (
		<div className="bg-base-100 lg:border lg:border-base-300 h-full flex flex-col min-w-0 overflow-hidden">
			<div className="hidden lg:flex h-9 items-center px-4 border-b border-base-300 flex-shrink-0">
				<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
					Budget
				</span>
			</div>
			<div className="px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap border-b border-base-300">
				<BudgetViewSelector value={view} onChange={setView} />
				<select
					aria-label="Budget period"
					className="select select-bordered select-sm w-full sm:w-auto min-w-0 max-w-full"
					value={selected?.id ?? ""}
					disabled={periodsLoading}
					onChange={(e) => {
						setSelectedId(e.target.value || null);
						setCopyError(null);
					}}
				>
					{!active && <option value="">No active budget</option>}
					{periods.map((p) => (
						<option key={p.id} value={p.id}>
							{periodLabel(p)}
							{p.id === active?.id ? " · Active" : ""}
						</option>
					))}
				</select>
				<button
					type="button"
					className="btn btn-sm btn-primary"
					disabled={periodsLoading}
					onClick={() => setModal("new")}
				>
					Create budget
				</button>
				{view === "history" && (
					<PillToggle
						ariaLabel="Budget history range"
						value={count}
						onChange={setCount}
						options={COUNT_OPTIONS}
					/>
				)}
			</div>
			{error && (
				<div role="alert" className="alert alert-error text-sm mx-4 mt-3">
					{error}
				</div>
			)}
			{periodsLoading ? (
				<div className="flex-1 grid place-items-center">
					<span
						className="loading loading-spinner loading-sm"
						role="status"
						aria-label="Loading budgets"
					/>
				</div>
			) : (
				<>
					{selected ? (
						<div className="px-4 py-3 flex-shrink-0 border-b border-base-300 flex flex-col gap-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm text-base-content/70">{periodLabel(selected)}</span>
								<button
									type="button"
									className="btn btn-xs btn-ghost"
									onClick={() => setModal(selected)}
								>
									Edit dates and cap
								</button>
							</div>
							{budget.isLoading ? (
								<span
									className="loading loading-spinner loading-sm"
									role="status"
									aria-label="Loading budget spending"
								/>
							) : budget.error ? null : (
								<BudgetAnchor
									key={selected.id}
									month={selected}
									overallCentavos={selected.overall_centavos}
									actualCentavos={budget.overallActualCentavos}
									allocatedSumCentavos={allocated}
									today={today}
									timezone={timezone}
									onSetOverall={budget.setOverall}
									onCopyFromPrevious={async () => null}
									canCopy={false}
								/>
							)}
							{previous && budget.allocations.length === 0 && !budget.isLoading && (
								<SubmitButton
									type="button"
									className="btn btn-sm btn-ghost self-start"
									loading={copying}
									onClick={copyPrevious}
								>
									Copy previous budget
								</SubmitButton>
							)}
						</div>
					) : (
						<div className="px-4 py-5 border-b border-base-300 flex-shrink-0">
							<p className="font-medium text-sm">No active budget</p>
							<p className="text-sm text-base-content/70 mt-1">
								Create a budget for your next date range, or select an earlier budget to review it.
							</p>
						</div>
					)}
					<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
						{view === "history" ? (
							<BudgetTagHistoryView
								tags={tags}
								history={history.history}
								overallHistory={history.history}
								selectedTagId={historyTagId}
								onSelectTag={setHistoryTagId}
								isLoading={history.isLoading}
							/>
						) : selected && !budget.isLoading && !budget.error ? (
							<BudgetTableView
								key={selected.id}
								tags={tags}
								allocations={budget.allocations}
								actualsByTag={budget.actualsByTag}
								othersCentavos={budget.othersCentavos}
								overallCentavos={selected.overall_centavos}
								month={selected}
								today={today}
								timezone={timezone}
								onUpsert={budget.upsertAllocation}
								onDelete={budget.deleteAllocation}
								disabled={false}
								focusTagId={null}
								onDrillToTag={onDrillToTag ? (tagId) => onDrillToTag(tagId, selected) : undefined}
							/>
						) : null}
					</div>
				</>
			)}
			{modal && (
				<BudgetPeriodModal
					period={modal === "new" ? undefined : modal}
					startDate={active ? shiftDaysISO(active.end_date, 1) : todayISO}
					periods={periods}
					onCancel={() => setModal(null)}
					onSave={async (range, cap) => {
						const result = await savePeriod(range, cap, modal === "new" ? undefined : modal.id);
						if (result.error) return result.error;
						setSelectedId(result.id);
						setModal(null);
						return null;
					}}
				/>
			)}
		</div>
	);
}
