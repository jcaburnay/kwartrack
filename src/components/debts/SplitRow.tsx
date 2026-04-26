import { ChevronDown, ChevronRight } from "lucide-react";
import type { ExpandedSplitParticipant } from "../../hooks/useDebtsAndSplits";
import { formatCentavos } from "../../utils/currency";
import type { SplitRow as SplitRowType } from "../../utils/splitFilters";
import { SplitRowExpansion } from "./SplitRowExpansion";

type Props = {
	split: SplitRowType;
	tagName: string;
	accountName: string;
	expanded: boolean;
	onToggle: () => void;
	loadParticipants: (splitId: string) => Promise<ExpandedSplitParticipant[]>;
	onSettleParticipant: (debtId: string) => void;
	onEdit: () => void;
	onDelete: () => void;
};

export function SplitRow({
	split,
	tagName,
	accountName,
	expanded,
	onToggle,
	loadParticipants,
	onSettleParticipant,
	onEdit,
	onDelete,
}: Props) {
	return (
		<>
			<tr className="cursor-pointer hover:bg-base-200" onClick={onToggle}>
				<td className="w-6">
					{expanded ? (
						<ChevronDown className="w-4 h-4" />
					) : (
						<ChevronRight className="w-4 h-4" />
					)}
				</td>
				<td>{split.description}</td>
				<td className="font-mono">{formatCentavos(split.totalCentavos)}</td>
				<td className="font-mono">{formatCentavos(split.userShareCentavos)}</td>
				<td>{accountName}</td>
				<td>{tagName}</td>
				<td>{split.date}</td>
				<td>{split.method}</td>
				<td>
					{split.settledCount}/{split.participantCount}
				</td>
			</tr>
			{expanded && (
				<tr>
					<td colSpan={9}>
						<SplitRowExpansion
							split={split}
							loadParticipants={loadParticipants}
							onSettleParticipant={onSettleParticipant}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					</td>
				</tr>
			)}
		</>
	);
}
