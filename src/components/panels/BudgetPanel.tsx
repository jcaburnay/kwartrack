import { useMemo } from "react";
import { useBudget } from "../../hooks/useBudget";
import { useTags } from "../../hooks/useTags";
import { useAuth } from "../../providers/AuthProvider";
import { formatCentavos } from "../../utils/currency";
import { monthBounds } from "../../utils/dateRange";

type Props = { onSeeAll: () => void };

export function BudgetPanel({ onSeeAll }: Props) {
	const { profile } = useAuth();
	const tz = profile?.timezone ?? "Asia/Manila";
	const monthStr = useMemo(() => monthBounds(tz).startISO.slice(0, 7), [tz]);

	const { config, allocations, actualsByTag, overallActualCentavos, isLoading } =
		useBudget(monthStr);
	const { tags } = useTags();

	const overall = config?.overall_centavos ?? 0;
	const overallPct =
		overall > 0 ? Math.min(100, Math.round((overallActualCentavos / overall) * 100)) : 0;
	const isOverBudget = overall > 0 && overallActualCentavos > overall;

	const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

	const topTags = useMemo(() => {
		return allocations
			.map((a) => ({
				id: a.tag_id,
				name: tagMap.get(a.tag_id) ?? a.tag_id,
				allocated: a.amount_centavos,
				actual: actualsByTag.get(a.tag_id) ?? 0,
			}))
			.sort((a, b) => b.actual - a.actual)
			.slice(0, 4);
	}, [allocations, actualsByTag, tagMap]);

	return (
		<div className="card bg-base-100 h-full flex flex-col">
			<div className="card-body gap-4 flex-1">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
						Budget
					</h2>
					<button type="button" className="text-xs text-primary hover:underline" onClick={onSeeAll}>
						See all →
					</button>
				</div>

				{isLoading ? (
					<div className="flex justify-center py-4">
						<span className="loading loading-spinner loading-sm text-primary" />
					</div>
				) : overall === 0 ? (
					<p className="text-sm text-base-content/50">No budget set for this month</p>
				) : (
					<>
						<div>
							<div className="flex justify-between text-xs text-base-content/60 mb-1">
								<span>Overall</span>
								<span className="tabular-nums">{overallPct}%</span>
							</div>
							<progress
								className={`progress w-full h-1.5 ${isOverBudget ? "progress-error" : "progress-success"}`}
								value={overallActualCentavos}
								max={overall}
							/>
							<div className="flex justify-between text-xs text-base-content/40 mt-0.5">
								<span>{formatCentavos(overallActualCentavos)}</span>
								<span>{formatCentavos(overall)}</span>
							</div>
						</div>

						<div className="space-y-3">
							{topTags.map((t) => {
								const pct =
									t.allocated > 0 ? Math.min(100, Math.round((t.actual / t.allocated) * 100)) : 0;
								const over = t.actual > t.allocated;
								return (
									<div key={t.id}>
										<div className="flex justify-between text-xs mb-1">
											<span className="truncate text-base-content/80">{t.name}</span>
											<span className="tabular-nums text-base-content/50 ml-2">{pct}%</span>
										</div>
										<progress
											className={`progress w-full h-1 ${over ? "progress-error" : "progress-warning"}`}
											value={t.actual}
											max={t.allocated}
										/>
									</div>
								);
							})}
							{topTags.length === 0 && (
								<p className="text-sm text-base-content/50">No tag allocations yet</p>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
