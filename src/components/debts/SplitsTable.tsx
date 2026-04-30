import type { ExpandedSplitParticipant } from "../../hooks/useDebtsAndSplits";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import type { SplitRow as SplitRowType } from "../../utils/splitFilters";
import { SplitRow } from "./SplitRow";

type Props = {
	splits: readonly SplitRowType[];
	tags: readonly Tag[];
	accounts: readonly Account[];
	expandedSplitId: string | null;
	onToggleExpand: (splitId: string) => void;
	loadParticipants: (splitId: string) => Promise<ExpandedSplitParticipant[]>;
	onSettleParticipant: (debtId: string) => void;
	onEditSplit: (splitId: string) => void;
	onDeleteSplit: (splitId: string) => void;
};

export function SplitsTable({
	splits,
	tags,
	accounts,
	expandedSplitId,
	onToggleExpand,
	loadParticipants,
	onSettleParticipant,
	onEditSplit,
	onDeleteSplit,
}: Props) {
	if (splits.length === 0) {
		return (
			<p className="text-sm text-base-content/60 italic">
				No debts or splits tracked yet. Split a bill with friends or record an IOU via the + button.
			</p>
		);
	}
	const tagsById = new Map(tags.map((t) => [t.id, t.name] as const));
	const accountsById = new Map(accounts.map((a) => [a.id, a.name] as const));
	return (
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
							onEdit={() => onEditSplit(s.id)}
							onDelete={() => onDeleteSplit(s.id)}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}
