import { Link } from "react-router";
import { getAvatarColor } from "../utils/avatarColor";
import { formatPesos } from "../utils/currency";
import { fromTimestamp } from "../utils/date";

interface SplitEvent {
	id: bigint;
	description: string;
	totalAmountCentavos: bigint;
	payerSubAccountId: bigint;
	tag: string;
	date: { microsSinceUnixEpoch: bigint };
	createdAt: { microsSinceUnixEpoch: bigint };
	splitMethod: string;
}

interface SplitParticipant {
	id: bigint;
	splitEventId: bigint;
	personName: string;
	shareAmountCentavos: bigint;
	debtId: bigint;
}

interface Debt {
	id: bigint;
	settledAmountCentavos: bigint;
	amountCentavos: bigint;
}

interface SplitCardProps {
	splitEvent: SplitEvent;
	participants: readonly SplitParticipant[];
	debts: readonly Debt[];
}

export function SplitCard({ splitEvent, participants, debts }: SplitCardProps) {
	const settledCount = participants.filter((p) => {
		const debt = debts.find((d) => d.id === p.debtId);
		return debt && debt.settledAmountCentavos >= debt.amountCentavos;
	}).length;

	const allSettled = settledCount === participants.length;
	const splitCount = participants.length + 1; // +1 for you
	// Use actual stored shares (not total/count) — floor division on odd totals
	// gives participants a smaller share than "you" even on equal splits.
	const yourShare =
		splitEvent.totalAmountCentavos - participants.reduce((s, p) => s + p.shareAmountCentavos, 0n);
	const allEqual = participants.every((p) => p.shareAmountCentavos === yourShare);
	const splitMethodLabel: Record<string, string> = {
		equal: "equal",
		exact: "exact amounts",
		percentage: "by percentage",
		shares: "by shares",
	};

	const avatar = getAvatarColor(splitEvent.description);
	const dateStr = fromTimestamp(splitEvent.date).toLocaleDateString("en-PH", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<Link
			to={`/splits/${splitEvent.id}`}
			className={`block rounded-xl bg-base-100 shadow-sm border border-base-300/50 card-hover${allSettled ? " opacity-60" : ""}`}
		>
			<div className="p-5 flex flex-col gap-2">
				{/* Avatar + Description */}
				<div className="flex items-center gap-3">
					<div
						className={`w-10 h-10 rounded-xl ${avatar.bg} ${avatar.text} flex-shrink-0 flex items-center justify-center text-sm font-bold`}
					>
						{splitEvent.description.charAt(0).toUpperCase()}
					</div>
					<div>
						<p className="text-sm font-semibold leading-tight">{splitEvent.description}</p>
						<p className="text-xs text-base-content/60">{dateStr}</p>
					</div>
				</div>

				{/* Amount */}
				<span className="font-mono text-sm font-semibold">
					{formatPesos(splitEvent.totalAmountCentavos)}
				</span>

				{/* Share info */}
				<p className="text-xs text-base-content/60">
					{allEqual ? (
						<>
							{splitCount}-way split · <span className="font-mono">{formatPesos(yourShare)}</span>{" "}
							each
						</>
					) : (
						<>
							{splitCount}-way split ·{" "}
							{splitMethodLabel[splitEvent.splitMethod] ?? splitEvent.splitMethod}
						</>
					)}
				</p>

				{/* Settlement badge + tag */}
				<div className="flex items-center gap-2">
					{allSettled ? (
						<span className="badge badge-sm badge-success">All settled</span>
					) : (
						<span className="badge badge-sm badge-warning">
							{settledCount} of {participants.length} settled
						</span>
					)}
					<span className="text-xs text-base-content/60">
						{splitEvent.tag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
					</span>
				</div>

				{/* Participant dots */}
				<div className="flex gap-1">
					{participants.map((p) => {
						const debt = debts.find((d) => d.id === p.debtId);
						const isSettled = debt && debt.settledAmountCentavos >= debt.amountCentavos;
						return (
							<div
								key={p.id.toString()}
								className={`w-2 h-2 rounded-full ${isSettled ? "bg-success" : "bg-base-300"}`}
								title={`${p.personName} — ${isSettled ? "settled" : "pending"}`}
							/>
						);
					})}
				</div>
			</div>
		</Link>
	);
}
