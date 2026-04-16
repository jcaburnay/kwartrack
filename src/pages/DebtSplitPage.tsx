import { useState } from "react";
import { DebtCard } from "../components/DebtCard";
import { DebtModal } from "../components/DebtModal";
import { NewItemCard } from "../components/NewItemCard";
import { SplitCard } from "../components/SplitCard";
import { SplitModal } from "../components/SplitModal";
import { useDebts, useSplits } from "../hooks";
import { formatPesos } from "../utils/currency";

export function DebtSplitPage() {
	const { debts, isLoading: isDebtsReady } = useDebts();
	const {
		events: splitEvents,
		participants: splitParticipants,
		isEventsLoading: isSplitsReady,
	} = useSplits();
	const [showDebtModal, setShowDebtModal] = useState(false);
	const [showSplitModal, setShowSplitModal] = useState(false);

	// Balance summary (computed from all unsettled debts)
	const totalOwedToYou = debts
		.filter((d) => d.direction === "loaned")
		.reduce((sum, d) => sum + (d.amountCentavos - d.settledAmountCentavos), 0n);
	const totalYouOwe = debts
		.filter((d) => d.direction === "owed")
		.reduce((sum, d) => sum + (d.amountCentavos - d.settledAmountCentavos), 0n);

	const isReady = isDebtsReady && isSplitsReady;
	if (!isReady) return null;

	// Group debts by personName
	const debtsByPerson = new Map<string, (typeof debts)[number][]>();
	for (const d of debts) {
		const existing = debtsByPerson.get(d.personName) ?? [];
		existing.push(d);
		debtsByPerson.set(d.personName, existing);
	}

	return (
		<div className="p-4 sm:p-6 space-y-8 ">
			{/* Balance summary strip */}
			<div data-testid="balance-strip" className="flex gap-4 bg-base-200/60 rounded-xl px-5 py-3">
				<div className="flex-1">
					<p className="text-xs text-base-content/60 mb-0.5">You're owed</p>
					<p className="font-mono text-sm font-semibold text-success">
						{formatPesos(totalOwedToYou)}
					</p>
				</div>
				<div className="w-px bg-base-300/60" />
				<div className="flex-1">
					<p className="text-xs text-base-content/60 mb-0.5">You owe</p>
					<p className="font-mono text-sm font-semibold text-error">{formatPesos(totalYouOwe)}</p>
				</div>
			</div>
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-5">
					DEBTS
				</h2>
				{debtsByPerson.size === 0 && (
					<p className="text-sm text-base-content/60 mb-3">
						Track money owed between you and others — personal loans, borrowed cash, informal
						credit.
					</p>
				)}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{[...debtsByPerson.entries()].map(([personName, personDebts], i) => (
						<div key={personName} className="" style={{ animationDelay: `${i * 0.06}s` }}>
							<DebtCard personName={personName} debts={personDebts} />
						</div>
					))}
					<NewItemCard label="New debt" onClick={() => setShowDebtModal(true)} />
				</div>
			</section>

			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-5">
					SPLITS
				</h2>
				{splitEvents.length === 0 && (
					<p className="text-sm text-base-content/60 mb-3">
						Group expenses split among people — dinners, trips, shared purchases. Tracks who still
						owes.
					</p>
				)}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{splitEvents.map((se, i) => {
						const participants = splitParticipants.filter((p) => p.splitEventId === se.id);
						return (
							<div key={se.id.toString()} className="" style={{ animationDelay: `${i * 0.06}s` }}>
								<SplitCard splitEvent={se} participants={participants} debts={debts} />
							</div>
						);
					})}
					<NewItemCard label="New split" onClick={() => setShowSplitModal(true)} />
				</div>
			</section>

			{showDebtModal && <DebtModal onClose={() => setShowDebtModal(false)} />}
			{showSplitModal && <SplitModal onClose={() => setShowSplitModal(false)} />}
		</div>
	);
}
