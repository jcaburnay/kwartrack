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
	onCrossFilter: () => void;
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
	onCrossFilter,
	onEdit,
	onDelete,
}: Props) {
	const subline = [tagName, split.date, accountName, split.method]
		.filter((v) => v && v !== "—")
		.join(" · ");
	return (
		<>
			<tr className="cursor-pointer hover:bg-base-200" onClick={onToggle}>
				<td>
					<div className="flex items-center gap-2 min-w-0">
						{expanded ? (
							<ChevronDown className="size-4 flex-shrink-0" />
						) : (
							<ChevronRight className="size-4 flex-shrink-0" />
						)}
						<div className="flex flex-col min-w-0">
							<span className="text-sm truncate">{split.description}</span>
							{subline && <span className="text-xs text-base-content/50 truncate">{subline}</span>}
						</div>
					</div>
				</td>
				<td className="text-right whitespace-nowrap">
					<div className="text-sm font-medium tabular-nums">
						{formatCentavos(split.totalCentavos)}
					</div>
					<div className="text-xs text-base-content/50 tabular-nums">
						your share {formatCentavos(split.userShareCentavos)}
					</div>
				</td>
				<td className="text-right whitespace-nowrap text-sm tabular-nums">
					{split.settledCount}/{split.participantCount}
				</td>
			</tr>
			{expanded && (
				<tr>
					<td colSpan={3}>
						<SplitRowExpansion
							split={split}
							loadParticipants={loadParticipants}
							onSettleParticipant={onSettleParticipant}
							onCrossFilter={onCrossFilter}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					</td>
				</tr>
			)}
		</>
	);
}
