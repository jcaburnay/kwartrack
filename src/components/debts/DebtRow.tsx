import { formatCentavos } from "../../utils/currency";
import type { DebtRow as DebtRowType } from "../../utils/debtFilters";

type Props = {
	debt: DebtRowType;
	tagName: string | null;
	onSettle: (id: string) => void;
	onDelete: (id: string) => void;
	canDelete: boolean;
};

export function DebtRow({ debt, tagName, onSettle, onDelete, canDelete }: Props) {
	const fullySettled = debt.settledCentavos >= debt.amountCentavos;
	const remaining = debt.amountCentavos - debt.settledCentavos;
	const subline = [debt.description, debt.date].filter(Boolean).join(" · ");
	return (
		<tr data-row-id={debt.id}>
			<td>
				<div className="flex flex-col min-w-0">
					<span className="text-sm truncate">{tagName ?? "—"}</span>
					{subline && <span className="text-xs text-base-content/50 truncate">{subline}</span>}
				</div>
			</td>
			<td className="text-right whitespace-nowrap">
				<div
					className={`text-sm font-medium tabular-nums ${
						debt.direction === "loaned" ? "text-success" : "text-error"
					}`}
				>
					{formatCentavos(debt.amountCentavos)}
				</div>
				{!fullySettled && debt.settledCentavos > 0 && (
					<div className="text-xs text-base-content/50 tabular-nums">
						{formatCentavos(remaining)} left
					</div>
				)}
			</td>
			<td className="text-right whitespace-nowrap">
				{fullySettled ? (
					<span className="badge badge-success badge-sm">✓ Settled</span>
				) : (
					<>
						<button
							type="button"
							className="btn btn-xs btn-primary touch-target"
							onClick={() => onSettle(debt.id)}
						>
							Settle
						</button>
						{canDelete && (
							<button
								type="button"
								className="btn btn-xs btn-ghost text-error ml-1 touch-target"
								onClick={() => onDelete(debt.id)}
							>
								Delete
							</button>
						)}
					</>
				)}
			</td>
		</tr>
	);
}
