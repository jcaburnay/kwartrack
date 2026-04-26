import { formatCentavos } from "../../utils/currency";
import type { DebtRow as DebtRowType } from "../../utils/debtFilters";
import { DebtRow } from "./DebtRow";

type Props = {
	personName: string;
	debts: DebtRowType[];
	tagsById: ReadonlyMap<string, string>;
	standaloneIds: ReadonlySet<string>;
	onSettle: (id: string) => void;
	onDelete: (id: string) => void;
};

export function DebtsPersonGroup({
	personName,
	debts,
	tagsById,
	standaloneIds,
	onSettle,
	onDelete,
}: Props) {
	let net = 0;
	for (const d of debts) {
		const remaining = d.amountCentavos - d.settledCentavos;
		if (remaining <= 0) continue;
		net += d.direction === "loaned" ? remaining : -remaining;
	}
	const netLabel =
		net > 0
			? `${formatCentavos(net)} net owed to you`
			: net < 0
				? `${formatCentavos(-net)} net you owe`
				: "All settled";

	return (
		<>
			<tr className="bg-base-200">
				<th colSpan={6}>
					<strong>{personName}</strong> — {netLabel}
				</th>
			</tr>
			{debts.map((d) => (
				<DebtRow
					key={d.id}
					debt={d}
					tagName={d.tagId ? (tagsById.get(d.tagId) ?? null) : null}
					onSettle={onSettle}
					onDelete={onDelete}
					canDelete={standaloneIds.has(d.id)}
				/>
			))}
		</>
	);
}
