import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { useDebtActions } from "../hooks";
import { getAvatarColor } from "../utils/avatarColor";
import { formatPesos } from "../utils/currency";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { SettleModal } from "./SettleModal";

interface Debt {
	id: bigint;
	personName: string;
	direction: string;
	amountCentavos: bigint;
	subAccountId: bigint;
	settledAmountCentavos: bigint;
	tag: string;
	description: string;
	splitEventId: bigint;
	date: { microsSinceUnixEpoch: bigint };
	createdAt: { microsSinceUnixEpoch: bigint };
}

interface DebtCardProps {
	personName: string;
	debts: readonly Debt[];
}

export function DebtCard({ personName, debts }: DebtCardProps) {
	const { remove: deleteDebt } = useDebtActions();
	const [settleTarget, setSettleTarget] = useState<Debt | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);

	// Aggregate: total owed to you (loaned) minus total you owe (owed)
	const totalLoaned = debts
		.filter((d) => d.direction === "loaned")
		.reduce((sum, d) => sum + (d.amountCentavos - d.settledAmountCentavos), 0n);
	const totalOwed = debts
		.filter((d) => d.direction === "owed")
		.reduce((sum, d) => sum + (d.amountCentavos - d.settledAmountCentavos), 0n);

	const netBalance = totalLoaned - totalOwed;
	const isFullySettled =
		netBalance === 0n && debts.every((d) => d.settledAmountCentavos >= d.amountCentavos);
	const primaryDirection = totalLoaned >= totalOwed ? "loaned" : "owed";

	const unsettledDebt = debts.find((d) => d.settledAmountCentavos < d.amountCentavos);

	const totalAmount = debts.reduce((sum, d) => sum + d.amountCentavos, 0n);
	const totalSettled = debts.reduce((sum, d) => sum + d.settledAmountCentavos, 0n);
	const progressPct = totalAmount > 0n ? Number((totalSettled * 100n) / totalAmount) : 0;

	const avatar = getAvatarColor(personName);

	return (
		<>
			<div
				className={`rounded-xl bg-base-100 shadow-sm border border-base-300/50 card-hover relative${isFullySettled ? " opacity-60" : ""}`}
			>
				<div className="p-5 flex flex-col gap-2 pr-8">
					{/* Avatar + Name */}
					<div className="flex items-center gap-3">
						<div
							className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
						>
							{personName.charAt(0).toUpperCase()}
						</div>
						<div>
							<p className="text-sm font-semibold leading-tight">{personName}</p>
							<p className="text-xs text-base-content/60">
								{debts.length} debt{debts.length !== 1 ? "s" : ""}
							</p>
						</div>
					</div>

					{/* Net balance */}
					<span
						className={`font-mono text-sm font-semibold ${primaryDirection === "loaned" ? "text-success" : "text-error"}`}
					>
						{primaryDirection === "loaned"
							? `owes you ${formatPesos(netBalance > 0n ? netBalance : -netBalance)}`
							: `you owe ${formatPesos(netBalance < 0n ? -netBalance : netBalance)}`}
					</span>

					{/* Badge + settled info */}
					<div className="flex items-center gap-2">
						{isFullySettled ? (
							<span className="badge badge-sm badge-success">Settled</span>
						) : (
							<span
								className={`badge badge-sm ${primaryDirection === "loaned" ? "badge-success" : "badge-error"}`}
							>
								{primaryDirection === "loaned" ? "LOANED" : "OWED"}
							</span>
						)}
						{!isFullySettled && totalSettled > 0n && (
							<span className="text-xs text-base-content/60">
								<span className="font-mono">{formatPesos(totalSettled)}</span> settled
							</span>
						)}
					</div>

					{/* Progress bar */}
					<div className="h-1 bg-base-300/50 rounded-full overflow-hidden">
						<div
							className={`h-full rounded-full ${primaryDirection === "loaned" ? "bg-success" : "bg-error"}`}
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>

				<div className="absolute top-3 right-3 z-10 dropdown dropdown-end">
					<button
						type="button"
						className="btn btn-ghost btn-xs btn-circle"
						aria-label="More actions"
					>
						<MoreVertical size={14} />
					</button>
					<ul className="dropdown-content menu bg-base-100 rounded-xl z-10 w-36 p-1 shadow-lg border border-base-300/50">
						{unsettledDebt && (
							<li>
								<button type="button" onClick={() => setSettleTarget(unsettledDebt)}>
									Settle
								</button>
							</li>
						)}
						<li>
							<button
								type="button"
								className="text-error"
								onClick={() => setDeleteTarget(debts[0])}
							>
								Delete
							</button>
						</li>
					</ul>
				</div>
			</div>

			{settleTarget && <SettleModal debt={settleTarget} onClose={() => setSettleTarget(null)} />}
			{deleteTarget && (
				<DeleteConfirmModal
					title={`Delete debt with ${personName}?`}
					body="This removes the debt record. Transactions already created are not affected."
					confirmLabel="Delete"
					dismissLabel="Keep it"
					onConfirm={() => {
						deleteDebt({ debtId: deleteTarget.id });
						setDeleteTarget(null);
					}}
					onDismiss={() => setDeleteTarget(null)}
				/>
			)}
		</>
	);
}
