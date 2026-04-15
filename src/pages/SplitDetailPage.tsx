import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useReducer, useTable } from "spacetimedb/react";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { SettleModal } from "../components/SettleModal";
import { SplitModal } from "../components/SplitModal";
import { reducers, tables } from "../module_bindings";
import { getAvatarColor } from "../utils/avatarColor";
import { formatPesos } from "../utils/currency";

export function SplitDetailPage() {
	const { id } = useParams<{ id: string }>();
	const splitId = (() => {
		try {
			return BigInt(id ?? "0");
		} catch {
			return 0n;
		}
	})();
	const navigate = useNavigate();
	const deleteSplit = useReducer(reducers.deleteSplit);

	const [splitEvents, isEventsReady] = useTable(tables.my_split_events);
	const [splitParticipants, isParticipantsReady] = useTable(tables.my_split_participants);
	const [debts, isDebtsReady] = useTable(tables.my_debts);
	const [subAccounts] = useTable(tables.my_sub_accounts);

	const [settleTarget, setSettleTarget] = useState<(typeof debts)[number] | null>(null);
	const [showEdit, setShowEdit] = useState(false);
	const [showDelete, setShowDelete] = useState(false);

	if (!isEventsReady || !isParticipantsReady || !isDebtsReady) return null;

	const splitEvent = splitEvents.find((se) => se.id === splitId);
	if (!splitEvent) {
		return (
			<div className="p-6">
				<p className="text-sm text-base-content/50">Split not found.</p>
			</div>
		);
	}

	const participants = splitParticipants.filter((p) => p.splitEventId === splitId);
	const splitDebts = debts.filter((d) => d.splitEventId === splitId);

	const payerSubAccount = subAccounts.find((s) => s.id === splitEvent.payerSubAccountId);
	const splitCount = participants.length + 1;
	const splitMethod = splitEvent.splitMethod ?? "equal";

	const splitMethodLabel: Record<string, string> = {
		equal: "Equal",
		exact: "Exact amounts",
		percentage: "By percentage",
		shares: "By shares",
	};

	const totalSettled = splitDebts.reduce((s, d) => s + d.settledAmountCentavos, 0n);
	const totalPending = splitDebts.reduce(
		(s, d) => s + (d.amountCentavos - d.settledAmountCentavos),
		0n,
	);

	const yourShare =
		splitEvent.totalAmountCentavos - participants.reduce((s, p) => s + p.shareAmountCentavos, 0n);

	const dateStr = new Date(Number(splitEvent.date.microsSinceUnixEpoch / 1000n)).toLocaleDateString(
		"en-PH",
		{ month: "short", day: "numeric", year: "numeric" },
	);

	const avatar = getAvatarColor(splitEvent.description);

	return (
		<div className="p-4 sm:p-6 space-y-6 animate-card-enter max-w-2xl">
			{/* Header */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					className="btn btn-ghost btn-sm gap-1"
					onClick={() => navigate("/debts")}
				>
					<ArrowLeft size={14} />
					Back
				</button>
				<div className="flex gap-2">
					<button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>
						<Edit size={14} />
						Edit
					</button>
					<button
						type="button"
						className="btn btn-ghost btn-sm text-error"
						onClick={() => setShowDelete(true)}
					>
						<Trash2 size={14} />
					</button>
				</div>
			</div>

			{/* Split summary */}
			<div className="bg-base-100 rounded-xl border border-base-300/50 p-5 flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<div
						className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
					>
						{splitEvent.description.charAt(0).toUpperCase()}
					</div>
					<div>
						<p className="font-semibold text-sm">{splitEvent.description}</p>
						<p className="text-xs text-base-content/50">{dateStr}</p>
					</div>
				</div>
				<p className="font-mono text-lg font-semibold">
					{formatPesos(splitEvent.totalAmountCentavos)}
				</p>
				<div className="flex items-center gap-2 flex-wrap">
					<span className="badge badge-sm badge-ghost">
						{splitEvent.tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
					</span>
					{payerSubAccount && (
						<span className="text-xs text-base-content/50">Paid from: {payerSubAccount.name}</span>
					)}
				</div>
			</div>

			{/* Participants */}
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-3">
					Participants
				</h2>
				<div className="flex flex-col gap-2">
					{participants.map((p) => {
						const debt = splitDebts.find((d) => d.id === p.debtId);
						const isSettled = debt ? debt.settledAmountCentavos >= debt.amountCentavos : false;
						const pAvatar = getAvatarColor(p.personName);

						return (
							<div
								key={p.id.toString()}
								className="flex items-center gap-3 bg-base-100 rounded-xl border border-base-300/50 px-4 py-3"
							>
								<div
									className={`w-8 h-8 rounded-lg ${pAvatar.bg} ${pAvatar.text} flex-shrink-0 flex items-center justify-center text-xs font-bold`}
								>
									{p.personName.charAt(0).toUpperCase()}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium">{p.personName}</p>
									<p className="text-xs text-base-content/50 font-mono">
										{formatPesos(p.shareAmountCentavos)}
									</p>
								</div>
								{isSettled ? (
									<span className="badge badge-sm badge-success">Settled</span>
								) : (
									debt && (
										<button
											type="button"
											className="btn btn-sm btn-ghost"
											onClick={() => setSettleTarget(debt)}
										>
											Settle
										</button>
									)
								)}
							</div>
						);
					})}
				</div>

				{/* Your share */}
				<div className="flex items-center justify-between mt-3 px-4 py-2 bg-base-200/40 rounded-xl">
					<span className="text-sm text-base-content/70">Your share</span>
					<span className="text-sm font-mono font-semibold">{formatPesos(yourShare)}</span>
				</div>
			</section>

			{/* Footer stats */}
			<div className="text-xs text-base-content/50 flex gap-3 flex-wrap">
				<span>{splitCount}-way split</span>
				<span>·</span>
				<span>{splitMethodLabel[splitMethod] ?? splitMethod}</span>
				{totalPending > 0n && (
					<>
						<span>·</span>
						<span className="text-warning">{formatPesos(totalPending)} pending</span>
					</>
				)}
				{totalSettled > 0n && (
					<>
						<span>·</span>
						<span className="text-success">{formatPesos(totalSettled)} settled</span>
					</>
				)}
			</div>

			{/* Modals */}
			{settleTarget && <SettleModal debt={settleTarget} onClose={() => setSettleTarget(null)} />}
			{showEdit && (
				<SplitModal
					onClose={() => setShowEdit(false)}
					editTarget={{
						splitEvent,
						participants: participants.map((p) => ({
							participantId: p.id,
							name: p.personName,
							shareAmountCentavos: p.shareAmountCentavos,
							shareCount: p.shareCount ?? 0,
						})),
					}}
				/>
			)}
			{showDelete && (
				<DeleteConfirmModal
					title={`Delete "${splitEvent.description}"?`}
					body="This removes the split record. Individual debts remain in your Debts section."
					confirmLabel="Delete split"
					dismissLabel="Keep it"
					onConfirm={() => {
						deleteSplit({ splitEventId: splitEvent.id });
						navigate("/debts");
					}}
					onDismiss={() => setShowDelete(false)}
				/>
			)}
		</div>
	);
}
