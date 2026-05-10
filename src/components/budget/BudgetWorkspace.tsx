import { useEffect, useMemo, useState } from "react";
import { useBudget } from "../../hooks/useBudget";
import { useBudgetHistory } from "../../hooks/useBudgetHistory";
import { useOverallBudgetHistory } from "../../hooks/useOverallBudgetHistory";
import { useTags } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { monthBounds } from "../../utils/dateRange";
import {
	ChartRangeToggle,
	type RangeOption,
	rangeToMonthCount,
} from "../overview/ChartRangeToggle";
import { BudgetAnchor } from "./BudgetAnchor";
import { BudgetTableView } from "./BudgetTableView";
import { BudgetTagHistoryView } from "./BudgetTagHistoryView";
import {
	type BudgetView,
	BudgetViewSelector,
	loadStoredBudgetView,
	storeBudgetView,
} from "./BudgetViewSelector";
import { MonthPicker } from "./MonthPicker";

type Props = {
	onDrillToTag?: (tagId: string, month: string) => void;
};

export function BudgetWorkspace({ onDrillToTag }: Props = {}) {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const today = useMemo(() => new Date(), []);
	const initialMonth = useMemo(() => monthBounds(tz).startISO.slice(0, 7), [tz]);
	const [month, setMonth] = useState(initialMonth);
	const [view, setView] = useState<BudgetView>(() => loadStoredBudgetView());
	const [range, setRange] = useState<RangeOption>("12m");
	const [historyTagId, setHistoryTagId] = useState<string | null>(null);

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
	const { history: overallHistory, isLoading: overallHistoryLoading } = useOverallBudgetHistory(
		month,
		view === "history" ? monthCount : 1,
	);

	const allocatedSum = allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const overall = config?.overall_centavos ?? 0;

	return (
		<div className="bg-base-100 lg:border lg:border-base-300 h-full flex flex-col min-w-0 overflow-hidden">
			<div className="hidden lg:flex h-9 items-center px-4 border-b border-base-300 flex-shrink-0">
				<span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
					Budget
				</span>
			</div>

			<div className="px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap border-b border-base-300">
				<BudgetViewSelector value={view} onChange={setView} />
				<MonthPicker month={month} onChange={setMonth} />
				{view === "history" && <ChartRangeToggle value={range} onChange={setRange} />}
			</div>

			{error && (
				<div className="mx-4 mt-3 flex-shrink-0">
					<div className="alert alert-error text-sm">{error}</div>
				</div>
			)}

			<div className="px-4 py-3 flex-shrink-0 border-b border-base-300">
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

			<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
				{isLoading ? (
					<div className="flex-1 flex items-center justify-center">
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
						focusTagId={null}
						onDrillToTag={onDrillToTag ? (tagId) => onDrillToTag(tagId, month) : undefined}
					/>
				) : (
					<BudgetTagHistoryView
						tags={tags}
						history={history}
						overallHistory={overallHistory}
						selectedTagId={historyTagId}
						onSelectTag={setHistoryTagId}
						isLoading={historyLoading || overallHistoryLoading}
					/>
				)}
			</div>
		</div>
	);
}
