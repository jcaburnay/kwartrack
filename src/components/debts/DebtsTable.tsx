import type { DebtRow as DebtRowType } from "../../utils/debtFilters";
import { DebtsPersonGroup } from "./DebtsPersonGroup";

type Props = {
	debts: readonly DebtRowType[];
	tagsById: ReadonlyMap<string, string>;
	standaloneDebtIds?: ReadonlySet<string>;
	onSettle: (id: string) => void;
	onDelete: (id: string) => void;
};

export function DebtsTable({ debts, tagsById, standaloneDebtIds, onSettle, onDelete }: Props) {
	const standalone = standaloneDebtIds ?? new Set<string>();
	const byPerson = new Map<string, { name: string; rows: DebtRowType[] }>();
	for (const d of debts) {
		const e = byPerson.get(d.personId);
		if (e) e.rows.push(d);
		else byPerson.set(d.personId, { name: d.personName, rows: [d] });
	}
	const groups = Array.from(byPerson.entries());

	if (groups.length === 0) {
		return (
			<p className="text-sm text-base-content/60 italic">
				No debts or splits tracked yet. Split a bill with friends or record an IOU via the + button.
			</p>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="table table-sm">
				<tbody>
					{groups.map(([personId, group]) => (
						<DebtsPersonGroup
							key={personId}
							personName={group.name}
							debts={group.rows}
							tagsById={tagsById}
							standaloneIds={standalone}
							onSettle={onSettle}
							onDelete={onDelete}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}
