import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
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
	return (
		<tr data-row-id={debt.id}>
			<td>{debt.date}</td>
			<td className="font-mono">{formatCentavos(debt.amountCentavos)}</td>
			<td>{debt.direction}</td>
			<td>{tagName ?? "—"}</td>
			<td className="text-sm text-base-content/70">{debt.description ?? ""}</td>
			<td className="text-right">
				<Link
					to={`/accounts?debt=${debt.id}`}
					className="btn btn-xs btn-ghost mr-1"
					aria-label="View transactions for this debt"
					title="View transactions for this debt"
				>
					<ExternalLink className="size-3" />
				</Link>
				{fullySettled ? (
					<span className="badge badge-success">✓ Settled</span>
				) : (
					<>
						<span className="text-xs text-base-content/60 mr-2">
							{formatCentavos(remaining)} left
						</span>
						<button
							type="button"
							className="btn btn-xs btn-primary"
							onClick={() => onSettle(debt.id)}
						>
							Settle
						</button>
						{canDelete && (
							<button
								type="button"
								className="btn btn-xs btn-ghost text-error ml-1"
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
