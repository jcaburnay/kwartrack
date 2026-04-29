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
import { formatCentavos, formatCentavosCompact } from "../../utils/currency";

type Props = {
	tags: readonly Tag[];
	history: readonly BudgetHistoryMonth[];
	selectedTagId: string | null;
	onSelectTag: (tagId: string) => void;
	isLoading: boolean;
};

export function BudgetTagHistoryView({
	tags,
	history,
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

	const data = selectedTagId
		? history.map((m) => ({
				label: m.monthLabel,
				monthISO: m.monthISO,
				budget: m.allocatedByTag.get(selectedTagId) ?? 0,
				actual: m.actualsByTag.get(selectedTagId) ?? 0,
			}))
		: [];
	const hasAnyData = data.some((d) => d.budget > 0 || d.actual > 0);

	return (
		<div className="flex flex-col gap-2 flex-1 min-h-0">
			<label className="form-control">
				<span className="label-text text-xs sr-only">Tag</span>
				<select
					aria-label="Tag"
					className="select select-bordered select-sm w-48"
					value={selectedTagId ?? ""}
					onChange={(e) => onSelectTag(e.target.value)}
				>
					<option value="" disabled>
						Pick a tag…
					</option>
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
				) : !selectedTagId ? (
					<p className="text-sm text-base-content/60">Pick a tag to see its history.</p>
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
								formatter={(value: number, name: string) => [formatCentavos(value), name]}
								labelFormatter={(_label, payload) => {
									const point = payload?.[0]?.payload as { label: string } | undefined;
									return point?.label ?? "";
								}}
							/>
							<Legend wrapperStyle={{ fontSize: 11 }} />
							<Bar dataKey="budget" name="Budget" className="fill-base-300" />
							<Bar dataKey="actual" name="Actual" className="fill-primary" />
						</BarChart>
					</ResponsiveContainer>
				)}
			</div>
		</div>
	);
}
