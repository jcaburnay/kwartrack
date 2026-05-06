import { ChevronDown, ChevronRight } from "lucide-react";
import { useContainerNarrow } from "../../hooks/useContainerNarrow";
import type { ExpandedSplitParticipant } from "../../hooks/useDebtsAndSplits";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { SplitRow as SplitRowType } from "../../utils/splitFilters";
import { SplitRow } from "./SplitRow";
import { SplitRowExpansion } from "./SplitRowExpansion";

type Props = {
	splits: readonly SplitRowType[];
	tags: readonly Tag[];
	accounts: readonly Account[];
	expandedSplitId: string | null;
	onToggleExpand: (splitId: string) => void;
	loadParticipants: (splitId: string) => Promise<ExpandedSplitParticipant[]>;
	onSettleParticipant: (debtId: string) => void;
	onCrossFilterSplit: (splitId: string) => void;
	onEditSplit: (splitId: string) => void;
	onDeleteSplit: (splitId: string) => void;
};

const CARD_MAX_WIDTH = 520;

export function SplitsTable({
	splits,
	tags,
	accounts,
	expandedSplitId,
	onToggleExpand,
	loadParticipants,
	onSettleParticipant,
	onCrossFilterSplit,
	onEditSplit,
	onDeleteSplit,
}: Props) {
	const { ref, isNarrow } = useContainerNarrow<HTMLDivElement>(CARD_MAX_WIDTH);

	if (splits.length === 0) {
		return (
			<div ref={ref}>
				<p className="text-sm text-base-content/60 italic">
					No debts or splits tracked yet. Split a bill with friends or record an IOU via the +
					button.
				</p>
			</div>
		);
	}
	const tagsById = new Map(tags.map((t) => [t.id, t.name] as const));
	const accountsById = new Map(accounts.map((a) => [a.id, a.name] as const));

	return (
		<div ref={ref}>
			{isNarrow ? (
				<ul className="flex flex-col divide-y divide-base-200">
					{splits.map((s) => {
						const expanded = expandedSplitId === s.id;
						const tagName = tagsById.get(s.tagId) ?? "—";
						const accountName = accountsById.get(s.paidFromAccountId) ?? "—";
						const subline = [tagName, s.date, accountName, s.method]
							.filter((v) => v && v !== "—")
							.join(" · ");
						return (
							<li key={s.id}>
								<button
									type="button"
									onClick={() => onToggleExpand(s.id)}
									className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-base-200 active:bg-base-200"
								>
									{expanded ? (
										<ChevronDown className="size-4 flex-shrink-0 mt-0.5" aria-hidden />
									) : (
										<ChevronRight className="size-4 flex-shrink-0 mt-0.5" aria-hidden />
									)}
									<div className="flex flex-col min-w-0 flex-1 gap-0.5">
										<div className="flex items-start justify-between gap-2">
											<span className="text-sm font-medium truncate">{s.description}</span>
											<span className="text-sm font-medium tabular-nums shrink-0">
												{formatCentavos(s.totalCentavos)}
											</span>
										</div>
										<div className="flex items-center justify-between gap-2 text-xs text-base-content/60">
											<span className="truncate min-w-0">{subline}</span>
											<span className="tabular-nums shrink-0">
												{s.settledCount}/{s.participantCount} settled
											</span>
										</div>
										<span className="text-xs text-base-content/50 tabular-nums">
											your share {formatCentavos(s.userShareCentavos)}
										</span>
									</div>
								</button>
								{expanded && (
									<div className="px-3 pb-3">
										<SplitRowExpansion
											split={s}
											loadParticipants={loadParticipants}
											onSettleParticipant={onSettleParticipant}
											onCrossFilter={() => onCrossFilterSplit(s.id)}
											onEdit={() => onEditSplit(s.id)}
											onDelete={() => onDeleteSplit(s.id)}
										/>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			) : (
				<div className="overflow-x-auto">
					<table className="table table-sm">
						<tbody>
							{splits.map((s) => (
								<SplitRow
									key={s.id}
									split={s}
									tagName={tagsById.get(s.tagId) ?? "—"}
									accountName={accountsById.get(s.paidFromAccountId) ?? "—"}
									expanded={expandedSplitId === s.id}
									onToggle={() => onToggleExpand(s.id)}
									loadParticipants={loadParticipants}
									onSettleParticipant={onSettleParticipant}
									onCrossFilter={() => onCrossFilterSplit(s.id)}
									onEdit={() => onEditSplit(s.id)}
									onDelete={() => onDeleteSplit(s.id)}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
