import { useEffect, useMemo, useState } from "react";
import { useBudget } from "../../hooks/useBudget";
import { useBudgetHistory } from "../../hooks/useBudgetHistory";
import { useTags } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { monthBounds } from "../../utils/dateRange";
import {
	ChartRangeToggle,
	type RangeOption,
	rangeToMonthCount,
} from "../overview/ChartRangeToggle";
import { BudgetAnchor } from "./BudgetAnchor";
import { BudgetComparisonView } from "./BudgetComparisonView";
import { BudgetTableView } from "./BudgetTableView";
import { BudgetTagHistoryView } from "./BudgetTagHistoryView";
import {
	type BudgetView,
	BudgetViewSelector,
	loadStoredBudgetView,
	storeBudgetView,
} from "./BudgetViewSelector";
import { MonthPicker } from "./MonthPicker";

export function BudgetWorkspace() {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const today = useMemo(() => new Date(), []);
	const initialMonth = useMemo(() => monthBounds(tz).startISO.slice(0, 7), [tz]);
	const [month, setMonth] = useState(initialMonth);
	const [view, setView] = useState<BudgetView>(() => loadStoredBudgetView());
	const [range, setRange] = useState<RangeOption>("12m");
	const [historyTagId, setHistoryTagId] = useState<string | null>(null);
	const [focusTagId, setFocusTagId] = useState<string | null>(null);

	useEffect(() => {
		storeBudgetView(view);
	}, [view]);

	const {
		config,
		allocations,
		actualsByTag,
		othersCentavos,
		overallActualCentavos,
		isLoading,
		error,
		setOverall,
		upsertAllocation,
		deleteAllocation,
		copyFromPrevious,
	} = useBudget(month);
	const { tags } = useTags();

	const monthCount = rangeToMonthCount(range);
	const { history, isLoading: historyLoading } = useBudgetHistory(
		month,
		view === "history" ? monthCount : 1,
	);

	const allocatedSum = allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const overall = config?.overall_centavos ?? 0;

	function handleComparisonClick(tagId: string) {
		setView("table");
		setFocusTagId(tagId);
	}

	return (
		<div className="card bg-base-100 h-full flex flex-col min-w-0 overflow-hidden">
			<div className="card-body gap-3 flex-1 min-w-0 min-h-0 flex flex-col">
				<div className="flex flex-col gap-2 flex-shrink-0 min-w-0">
					<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
						Budget
					</h2>
					<div className="flex items-center gap-2 flex-wrap min-w-0">
						<BudgetViewSelector value={view} onChange={setView} />
						<MonthPicker month={month} onChange={setMonth} />
						{view === "history" && <ChartRangeToggle value={range} onChange={setRange} />}
					</div>
				</div>

				{error && <div className="alert alert-error text-sm flex-shrink-0">{error}</div>}

				<div className="flex-shrink-0">
					<BudgetAnchor
						month={month}
						overallCentavos={config ? overall : null}
						actualCentavos={overallActualCentavos}
						allocatedSumCentavos={allocatedSum}
						today={today}
						timezone={tz}
						onSetOverall={setOverall}
						onCopyFromPrevious={copyFromPrevious}
						canCopy={config == null}
					/>
				</div>

				<div className="flex-1 min-h-0 flex flex-col">
					{isLoading ? (
						<div className="flex justify-center py-4">
							<span className="loading loading-spinner loading-sm text-primary" />
						</div>
					) : config == null ? null : view === "table" ? (
						<BudgetTableView
							tags={tags}
							allocations={allocations}
							actualsByTag={actualsByTag}
							othersCentavos={othersCentavos}
							overallCentavos={overall}
							month={month}
							today={today}
							timezone={tz}
							onUpsert={upsertAllocation}
							onDelete={deleteAllocation}
							disabled={config == null}
							focusTagId={focusTagId}
						/>
					) : view === "comparison" ? (
						<BudgetComparisonView
							tags={tags}
							allocations={allocations}
							actualsByTag={actualsByTag}
							month={month}
							today={today}
							timezone={tz}
							onTagClick={handleComparisonClick}
						/>
					) : (
						<BudgetTagHistoryView
							tags={tags}
							history={history}
							selectedTagId={historyTagId}
							onSelectTag={setHistoryTagId}
							isLoading={historyLoading}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
