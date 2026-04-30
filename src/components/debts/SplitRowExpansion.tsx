import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExpandedSplitParticipant } from "../../hooks/useDebtsAndSplits";
import { formatCentavos } from "../../utils/currency";
import type { SplitRow as SplitRowType } from "../../utils/splitFilters";
import { SplitParticipantRow } from "./SplitParticipantRow";

type Props = {
	split: SplitRowType;
	loadParticipants: (splitId: string) => Promise<ExpandedSplitParticipant[]>;
	onSettleParticipant: (debtId: string) => void;
	onCrossFilter: () => void;
	onEdit: () => void;
	onDelete: () => void;
};

export function SplitRowExpansion({
	split,
	loadParticipants,
	onSettleParticipant,
	onCrossFilter,
	onEdit,
	onDelete,
}: Props) {
	const [parts, setParts] = useState<ExpandedSplitParticipant[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		loadParticipants(split.id).then((rows) => {
			if (!cancelled) {
				setParts(rows);
				setLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [split.id, loadParticipants]);

	const pending = parts.reduce((a, p) => a + Math.max(0, p.shareCentavos - p.settledCentavos), 0);
	const settled = parts.reduce((a, p) => a + Math.min(p.settledCentavos, p.shareCentavos), 0);

	return (
		<div className="bg-base-200 p-3 rounded-md">
			<div className="flex justify-end gap-1 mb-2">
				<button
					type="button"
					className="btn btn-xs btn-ghost"
					onClick={onCrossFilter}
					aria-label="View transactions for this split"
				>
					<ExternalLink className="size-3" />
					Transactions
				</button>
				<button type="button" className="btn btn-xs btn-ghost" onClick={onEdit}>
					Edit
				</button>
				<button
					type="button"
					className="btn btn-xs btn-ghost text-error"
					onClick={() => {
						if (window.confirm("Delete this split?")) onDelete();
					}}
				>
					Delete
				</button>
			</div>
			{loading ? (
				<div className="flex justify-center py-2">
					<span className="loading loading-spinner loading-sm" />
				</div>
			) : (
				<table className="table table-xs">
					<tbody>
						{parts.map((p) => (
							<SplitParticipantRow
								key={p.participantId}
								participant={p}
								onSettle={onSettleParticipant}
							/>
						))}
						<tr className="bg-base-300">
							<td>You</td>
							<td className="tabular-nums">{formatCentavos(split.userShareCentavos)}</td>
							<td className="text-right text-xs text-base-content/60">your share</td>
						</tr>
					</tbody>
				</table>
			)}
			<p className="text-xs text-base-content/60 text-right mt-2">
				{split.participantCount + 1}-way · {split.method} · {formatCentavos(pending)} pending ·{" "}
				{formatCentavos(settled)} settled
			</p>
		</div>
	);
}
