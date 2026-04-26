import { Link } from "react-router";
import type { BudgetAllocation } from "../../hooks/useBudget";
import type { Tag } from "../../hooks/useTags";
import { formatCentavos } from "../../utils/currency";
import { selectTopTagsByActual } from "../../utils/overviewAggregation";

type Props = {
	actualsByTag: ReadonlyMap<string, number>;
	overallActualCentavos: number;
	overallCapCentavos: number;
	allocations: readonly BudgetAllocation[];
	tags: readonly Tag[];
	isLoading: boolean;
};

function pctClass(pct: number): string {
	if (pct > 1) return "progress-error";
	if (pct >= 0.8) return "progress-warning";
	return "progress-success";
}

export function BudgetProgressCondensed({
	actualsByTag,
	overallActualCentavos,
	overallCapCentavos,
	allocations,
	tags,
	isLoading,
}: Props) {
	if (isLoading) {
		return (
			<section className="card bg-base-100 shadow-sm">
				<div className="card-body gap-3">
					<h3 className="card-title text-lg">Budget — this month</h3>
					<div className="skeleton h-4 w-full" />
					<div className="skeleton h-4 w-full" />
					<div className="skeleton h-4 w-full" />
				</div>
			</section>
		);
	}

	if (overallCapCentavos === 0) {
		return (
			<section className="card bg-base-100 shadow-sm">
				<div className="card-body gap-3">
					<h3 className="card-title text-lg">Budget — this month</h3>
					<p className="text-base-content/70">
						No budget set this month. Start by setting an Overall cap.
					</p>
					<Link to="/budget" className="btn btn-primary btn-sm w-fit">
						Set Budget
					</Link>
				</div>
			</section>
		);
	}

	const overallPct = overallActualCentavos / overallCapCentavos;
	const topTags = selectTopTagsByActual(actualsByTag, allocations, tags, 5);

	return (
		<section className="card bg-base-100 shadow-sm">
			<div className="card-body gap-3">
				<h3 className="card-title text-lg">Budget — this month</h3>

				<Link to="/budget" className="block hover:opacity-80">
					<div className="flex justify-between text-sm">
						<span>Overall</span>
						<span>
							{formatCentavos(overallActualCentavos)} of {formatCentavos(overallCapCentavos)}
						</span>
					</div>
					<progress
						className={`progress h-2 w-full ${pctClass(overallPct)}`}
						value={Math.min(100, Math.round(overallPct * 100))}
						max="100"
					/>
				</Link>

				{topTags.length > 0 && (
					<div className="flex flex-col gap-2">
						{topTags.map((row) => (
							<Link
								key={row.tagId}
								to="/budget"
								data-testid="budget-progress-row"
								className="block hover:opacity-80"
							>
								<div className="flex justify-between text-sm">
									<span>{row.tagName}</span>
									<span>
										{formatCentavos(row.actualCentavos)} / {formatCentavos(row.budgetCentavos)}
									</span>
								</div>
								<progress
									className={`progress h-1 w-full ${pctClass(row.pct)}`}
									value={Math.min(100, Math.round(row.pct * 100))}
									max="100"
								/>
							</Link>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
