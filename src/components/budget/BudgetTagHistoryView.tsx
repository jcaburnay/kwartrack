import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { Tag } from "../../hooks/useTags";
import type { BudgetHistoryMonth } from "../../utils/budgetHistory";
import { chartTooltipProps } from "../../utils/chartTheme";
import { formatCentavos, formatCentavosCompact } from "../../utils/currency";
import type { OverallBudgetHistoryMonth } from "../../utils/overallBudgetHistory";

export const OVERALL_VALUE = "__overall__";

type Props = {
	tags: readonly Tag[];
	history: readonly BudgetHistoryMonth[];
	overallHistory: readonly OverallBudgetHistoryMonth[];
	selectedTagId: string | null;
	onSelectTag: (tagId: string) => void;
	isLoading: boolean;
};

export function BudgetTagHistoryView({
	tags,
	history,
	overallHistory,
	selectedTagId,
	onSelectTag,
	isLoading,
}: Props) {
	const selectableTags = tags
		.filter((t) => {
			if (t.is_system) return t.name === "transfer-fees";
			return t.type === "expense";
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	const isOverall = selectedTagId === OVERALL_VALUE;
	const data = isOverall
		? overallHistory.map((m) => ({
				label: m.monthLabel,
				monthISO: m.monthISO,
				budget: m.capCentavos,
				actual: m.actualCentavos,
			}))
		: selectedTagId
			? history.map((m) => ({
					label: m.monthLabel,
					monthISO: m.monthISO,
					budget: m.allocatedByTag.get(selectedTagId) ?? 0,
					actual: m.actualsByTag.get(selectedTagId) ?? 0,
				}))
			: [];
	const hasAnyData = data.some((d) => d.budget > 0 || d.actual > 0);

	return (
		<div className="flex flex-col gap-2 flex-1 min-h-0 px-4 py-3">
			<label className="form-control">
				<span className="label-text text-xs sr-only">Tag</span>
				<select
					aria-label="Tag"
					className="select select-bordered select-sm w-48"
					value={selectedTagId ?? OVERALL_VALUE}
					onChange={(e) => onSelectTag(e.target.value)}
				>
					<option value={OVERALL_VALUE}>Overall (all expenses)</option>
					{selectableTags.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
			</label>

			<div className="flex-1 min-h-0">
				{isLoading ? (
					<div className="skeleton h-full w-full" />
				) : !hasAnyData ? (
					<p className="text-sm text-base-content/60">No data for this range.</p>
				) : (
					<ResponsiveContainer width="100%" height="100%" minHeight={160}>
						<BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
							<CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
							<XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
							<YAxis
								tick={{ fontSize: 11 }}
								tickFormatter={(v: number) => formatCentavosCompact(v)}
								width={56}
							/>
							<Tooltip
								{...chartTooltipProps}
								formatter={(value: number, name: string) => [formatCentavos(value), name]}
								labelFormatter={(_label, payload) => {
									const point = payload?.[0]?.payload as { label: string } | undefined;
									return point?.label ?? "";
								}}
							/>
							<Legend
								wrapperStyle={{ fontSize: 11 }}
								formatter={(value) => <span className="text-base-content">{value}</span>}
							/>
							<Bar dataKey="budget" name="Budget" fill="var(--color-base-content)" />
							<Bar dataKey="actual" name="Actual" fill="var(--color-primary)" />
						</BarChart>
					</ResponsiveContainer>
				)}
			</div>
		</div>
	);
}
