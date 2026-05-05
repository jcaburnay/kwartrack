import type { ExpandedSplitParticipant } from "../../hooks/useDebtsAndSplits";
import { formatCentavos } from "../../utils/currency";

type Props = {
	participant: ExpandedSplitParticipant;
	onSettle: (debtId: string) => void;
};

export function SplitParticipantRow({ participant, onSettle }: Props) {
	const remaining = participant.shareCentavos - participant.settledCentavos;
	const fullySettled = remaining <= 0;
	const partial = participant.settledCentavos > 0 && !fullySettled;
	return (
		<tr>
			<td>{participant.personName}</td>
			<td className="tabular-nums">{formatCentavos(participant.shareCentavos)}</td>
			<td className="text-right">
				{fullySettled ? (
					<span className="badge badge-success">✓ Settled</span>
				) : (
					<>
						{partial && (
							<span className="text-xs text-base-content/60 mr-2">
								{formatCentavos(participant.settledCentavos)} settled
							</span>
						)}
						<button
							type="button"
							className="btn btn-xs btn-primary"
							onClick={() => onSettle(participant.debtId)}
						>
							Settle ▸
						</button>
					</>
				)}
			</td>
		</tr>
	);
}
