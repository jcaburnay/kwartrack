import { useContainerNarrow } from "../../hooks/useContainerNarrow";
import { formatCentavos } from "../../utils/currency";
import type { DebtRow as DebtRowType } from "../../utils/debtFilters";
import { DebtsPersonGroup } from "./DebtsPersonGroup";

type Props = {
	debts: readonly DebtRowType[];
	tagsById: ReadonlyMap<string, string>;
	standaloneDebtIds?: ReadonlySet<string>;
	onSettle: (id: string) => void;
	onDelete: (id: string) => void;
};

const CARD_MAX_WIDTH = 480;

export function DebtsTable({ debts, tagsById, standaloneDebtIds, onSettle, onDelete }: Props) {
	const standalone = standaloneDebtIds ?? new Set<string>();
	const byPerson = new Map<string, { name: string; rows: DebtRowType[] }>();
	for (const d of debts) {
		const e = byPerson.get(d.personId);
		if (e) e.rows.push(d);
		else byPerson.set(d.personId, { name: d.personName, rows: [d] });
	}
	const groups = Array.from(byPerson.entries());
	const { ref, isNarrow } = useContainerNarrow<HTMLDivElement>(CARD_MAX_WIDTH);

	if (groups.length === 0) {
		return (
			<div ref={ref}>
				<p className="text-sm text-base-content/60 italic">
					No debts or splits tracked yet. Split a bill with friends or record an IOU via the +
					button.
				</p>
			</div>
		);
	}

	return (
		<div ref={ref}>
			{isNarrow ? (
				<div className="flex flex-col">
					{groups.map(([personId, group]) => (
						<DebtsPersonCardGroup
							key={personId}
							personName={group.name}
							debts={group.rows}
							tagsById={tagsById}
							standaloneIds={standalone}
							onSettle={onSettle}
							onDelete={onDelete}
						/>
					))}
				</div>
			) : (
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
			)}
		</div>
	);
}

type CardGroupProps = {
	personName: string;
	debts: DebtRowType[];
	tagsById: ReadonlyMap<string, string>;
	standaloneIds: ReadonlySet<string>;
	onSettle: (id: string) => void;
	onDelete: (id: string) => void;
};

function DebtsPersonCardGroup({
	personName,
	debts,
	tagsById,
	standaloneIds,
	onSettle,
	onDelete,
}: CardGroupProps) {
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
		<section className="border-b border-base-200 last:border-b-0">
			<header className="sticky top-0 z-10 bg-base-200 px-3 py-1.5 text-xs">
				<strong className="font-semibold">{personName}</strong>{" "}
				<span className="text-base-content/60">— {netLabel}</span>
			</header>
			<ul className="flex flex-col divide-y divide-base-200">
				{debts.map((d) => (
					<DebtCard
						key={d.id}
						debt={d}
						tagName={d.tagId ? (tagsById.get(d.tagId) ?? null) : null}
						onSettle={onSettle}
						onDelete={onDelete}
						canDelete={standaloneIds.has(d.id)}
					/>
				))}
			</ul>
		</section>
	);
}

type CardProps = {
	debt: DebtRowType;
	tagName: string | null;
	onSettle: (id: string) => void;
	onDelete: (id: string) => void;
	canDelete: boolean;
};

function DebtCard({ debt, tagName, onSettle, onDelete, canDelete }: CardProps) {
	const fullySettled = debt.settledCentavos >= debt.amountCentavos;
	const remaining = debt.amountCentavos - debt.settledCentavos;
	const subline = [debt.description, debt.date].filter(Boolean).join(" · ");
	return (
		<li data-row-id={debt.id} className="px-3 py-2.5 flex items-center gap-2">
			<div className="flex flex-col min-w-0 flex-1">
				<span className="text-sm truncate">{tagName ?? "—"}</span>
				{subline && <span className="text-xs text-base-content/50 truncate">{subline}</span>}
			</div>
			<div className="text-right whitespace-nowrap shrink-0">
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
			</div>
			<div className="flex items-center gap-1 shrink-0">
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
								className="btn btn-xs btn-ghost text-error touch-target"
								onClick={() => onDelete(debt.id)}
							>
								Delete
							</button>
						)}
					</>
				)}
			</div>
		</li>
	);
}
