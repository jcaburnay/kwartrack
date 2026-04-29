import type { BudgetAllocation } from "../../hooks/useBudget";
import type { Tag } from "../../hooks/useTags";
import { type ActualsByTag, projectedBucket } from "../../utils/budgetMath";
import { type SortableRow, sortByOvershootRisk } from "../../utils/budgetSorting";
import { formatCentavos } from "../../utils/currency";

const BUCKET_FILL = {
	empty: "bg-base-300",
	green: "bg-success",
	orange: "bg-warning",
	red: "bg-error",
} as const;

type Props = {
	tags: readonly Tag[];
	allocations: readonly BudgetAllocation[];
	actualsByTag: ActualsByTag;
	month: string;
	today: Date;
	timezone: string;
	onTagClick: (tagId: string) => void;
};

export function BudgetComparisonView({
	tags,
	allocations,
	actualsByTag,
	month,
	today,
	timezone,
	onTagClick,
}: Props) {
	if (allocations.length === 0) {
		return (
			<p className="text-sm text-base-content/60 px-4 py-3">
				No tag caps yet — add one to track per-tag spending.
			</p>
		);
	}
	const tagById = new Map(tags.map((t) => [t.id, t]));
	const rows: SortableRow[] = allocations.map((a) => ({
		tagId: a.tag_id,
		tagName: tagById.get(a.tag_id)?.name ?? a.tag_id,
		allocated: a.amount_centavos,
		actual: actualsByTag.get(a.tag_id) ?? 0,
	}));
	const sorted = sortByOvershootRisk(rows, today, timezone, month);

	return (
		<ul
			className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 px-4 py-3"
			style={{
				maskImage: "linear-gradient(to bottom, black calc(100% - 1.25rem), transparent 100%)",
				WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 1.25rem), transparent 100%)",
			}}
		>
			{sorted.map((row) => {
				const bucket = projectedBucket(row.actual, row.allocated, today, timezone, month);
				const pct =
					row.allocated > 0 ? Math.min(100, Math.round((row.actual / row.allocated) * 100)) : 0;
				const fillWidth = row.allocated > 0 ? Math.min(100, (row.actual / row.allocated) * 100) : 0;
				return (
					<li key={row.tagId}>
						<button
							type="button"
							className="w-full text-left flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							onClick={() => onTagClick(row.tagId)}
							data-tag-id={row.tagId}
							aria-label={`${row.tagName}: ${formatCentavos(row.actual)} of ${formatCentavos(row.allocated)}`}
						>
							<div className="flex items-baseline justify-between gap-2 text-sm">
								<span className="truncate font-medium">{row.tagName}</span>
								<span className="text-xs text-base-content/50 tabular-nums">
									{formatCentavos(row.actual)} / {formatCentavos(row.allocated)} · {pct}%
								</span>
							</div>
							<div className="relative w-full h-2 bg-base-200 rounded-full overflow-hidden">
								<div
									className={`h-full ${BUCKET_FILL[bucket]}`}
									style={{ width: `${fillWidth}%` }}
								/>
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
