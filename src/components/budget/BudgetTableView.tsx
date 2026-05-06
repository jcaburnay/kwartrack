import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import type { BudgetAllocation } from "../../hooks/useBudget";
import { useScrollAndFlash } from "../../hooks/useScrollAndFlash";
import { useShouldShowBottomFade } from "../../hooks/useScrollFadeMask";
import type { Tag } from "../../hooks/useTags";
import { type ActualsByTag, projectedBucket } from "../../utils/budgetMath";
import { type SortableRow, sortByOvershootRisk } from "../../utils/budgetSorting";
import { formatCentavos } from "../../utils/currency";
import { EditAllocationModal } from "./EditAllocationModal";
import { NewAllocationModal } from "./NewAllocationModal";

const BUCKET_BAR_CLASS = {
	empty: "bg-base-300",
	green: "bg-success",
	orange: "bg-warning",
	red: "bg-error",
} as const;

type Props = {
	tags: readonly Tag[];
	allocations: readonly BudgetAllocation[];
	actualsByTag: ActualsByTag;
	othersCentavos: number;
	overallCentavos: number;
	month: string;
	today: Date;
	timezone: string;
	onUpsert: (tagId: string, centavos: number) => Promise<string | null>;
	onDelete: (tagId: string) => Promise<string | null>;
	disabled: boolean;
	focusTagId: string | null;
};

export function BudgetTableView({
	tags,
	allocations,
	actualsByTag,
	othersCentavos,
	overallCentavos,
	month,
	today,
	timezone,
	onUpsert,
	onDelete,
	disabled,
	focusTagId,
}: Props) {
	const [editingAllocation, setEditingAllocation] = useState<BudgetAllocation | null>(null);
	const [showAdd, setShowAdd] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const showFade = useShouldShowBottomFade(scrollRef);

	useScrollAndFlash(focusTagId, allocations.length > 0);

	const tagById = new Map(tags.map((t) => [t.id, t]));
	const allocatedSum = allocations.reduce((s, a) => s + a.amount_centavos, 0);
	const allocatedSet = new Set(allocations.map((a) => a.tag_id));

	const candidateTags = tags
		.filter((t) => !allocatedSet.has(t.id))
		.filter((t) => {
			if (t.is_system) return t.name === "transfer-fees";
			return t.type === "expense";
		});

	const sortableRows: SortableRow[] = allocations.map((a) => ({
		tagId: a.tag_id,
		tagName: tagById.get(a.tag_id)?.name ?? a.tag_id,
		allocated: a.amount_centavos,
		actual: actualsByTag.get(a.tag_id) ?? 0,
	}));
	const sorted = sortByOvershootRisk(sortableRows, today, timezone, month);

	return (
		<div className="flex flex-col min-h-0 flex-1 overflow-hidden">
			<div
				ref={scrollRef}
				className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 ${showFade ? "scroll-fade-bottom" : ""}`}
			>
				<table className="table table-sm">
					<thead className="sticky top-0 bg-base-100 z-10">
						<tr>
							<th>Tag</th>
							<th className="text-right whitespace-nowrap">₱actual / ₱budget</th>
							<th>Progress</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((row) => {
							const allocation = allocations.find((a) => a.tag_id === row.tagId);
							if (!allocation) return null;
							const actual = row.actual;
							const remaining = row.allocated - actual;
							const bucket = projectedBucket(actual, row.allocated, today, timezone, month);
							const barWidth =
								row.allocated > 0 ? Math.min(100, (actual / row.allocated) * 100) : 0;
							return (
								<tr key={row.tagId} data-row-id={row.tagId}>
									<td className="font-medium">{row.tagName}</td>
									<td className="text-right tabular-nums whitespace-nowrap">
										<span>{formatCentavos(actual)}</span>
										<span className="text-base-content/50"> / {formatCentavos(row.allocated)}</span>
									</td>
									<td>
										<div className="flex flex-col gap-1 w-32">
											<div className="h-2 bg-base-200 rounded-full overflow-hidden">
												<div
													className={`h-full ${BUCKET_BAR_CLASS[bucket]}`}
													style={{ width: `${barWidth}%` }}
												/>
											</div>
											<span
												className={`text-xs tabular-nums whitespace-nowrap ${remaining < 0 ? "text-error" : "text-base-content/50"}`}
											>
												{remaining < 0
													? `${formatCentavos(-remaining)} over`
													: `${formatCentavos(remaining)} left`}
											</span>
										</div>
									</td>
									<td className="text-right">
										{!disabled && (
											<button
												type="button"
												className="btn btn-xs btn-ghost touch-target"
												aria-label={`Edit ${row.tagName}`}
												onClick={() => setEditingAllocation(allocation)}
											>
												<Pencil className="w-3.5 h-3.5" />
											</button>
										)}
									</td>
								</tr>
							);
						})}
						<tr className="text-base-content/70">
							<td className="italic">Others (unbudgeted)</td>
							<td className="text-right tabular-nums whitespace-nowrap">
								{formatCentavos(othersCentavos)}
							</td>
							<td>—</td>
							<td></td>
						</tr>
					</tbody>
				</table>
			</div>

			<div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-base-200 flex-shrink-0">
				<span className="text-xs text-base-content/50">
					Allocated total: {formatCentavos(allocatedSum)}
				</span>
				{!disabled && candidateTags.length > 0 && (
					<button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowAdd(true)}>
						+ Add allocation
					</button>
				)}
			</div>

			{showAdd && (
				<NewAllocationModal
					candidateTags={candidateTags}
					allocatedSumCentavos={allocatedSum}
					overallCentavos={overallCentavos}
					onUpsert={onUpsert}
					onSaved={() => setShowAdd(false)}
					onCancel={() => setShowAdd(false)}
				/>
			)}

			{editingAllocation && (
				<EditAllocationModal
					allocation={editingAllocation}
					tagName={tagById.get(editingAllocation.tag_id)?.name ?? editingAllocation.tag_id}
					allocatedSumCentavos={allocatedSum}
					overallCentavos={overallCentavos}
					onUpsert={onUpsert}
					onDelete={onDelete}
					onSaved={() => setEditingAllocation(null)}
					onCancel={() => setEditingAllocation(null)}
				/>
			)}
		</div>
	);
}
