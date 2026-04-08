import { useState } from "react";
import { useTable } from "spacetimedb/react";
import { DebtCard } from "../components/DebtCard";
import { DebtModal } from "../components/DebtModal";
import { SplitCard } from "../components/SplitCard";
import { SplitModal } from "../components/SplitModal";
import { tables } from "../module_bindings";

export function DebtSplitPage() {
	const [debts, isDebtsReady] = useTable(tables.my_debts);
	const [splitEvents, isSplitsReady] = useTable(tables.my_split_events);
	const [splitParticipants] = useTable(tables.my_split_participants);
	const [showDebtModal, setShowDebtModal] = useState(false);
	const [showSplitModal, setShowSplitModal] = useState(false);

	if (!isDebtsReady || !isSplitsReady) return null;

	// Group debts by personName
	const debtsByPerson = new Map<string, (typeof debts)[number][]>();
	for (const d of debts) {
		const existing = debtsByPerson.get(d.personName) ?? [];
		existing.push(d);
		debtsByPerson.set(d.personName, existing);
	}

	const addButton = (label: string, onClick: () => void) => (
		<button
			type="button"
			className="border-2 border-dashed border-base-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors bg-transparent w-full min-h-[140px]"
			onClick={onClick}
		>
			<span className="text-base-content/50 text-sm">+ {label}</span>
		</button>
	);

	return (
		<div className="p-4 sm:p-6 space-y-8">
			<section>
				<p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-5">
					DEBTS
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{[...debtsByPerson.entries()].map(([personName, personDebts], i) => (
						<div
							key={personName}
							className="animate-card-enter"
							style={{ animationDelay: `${i * 0.06}s` }}
						>
							<DebtCard personName={personName} debts={personDebts} />
						</div>
					))}
					{addButton("Add debt", () => setShowDebtModal(true))}
				</div>
			</section>

			<section>
				<p className="text-xs font-semibold tracking-widest text-base-content/40 uppercase mb-5">
					SPLITS
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{splitEvents.map((se, i) => {
						const participants = splitParticipants.filter((p) => p.splitEventId === se.id);
						return (
							<div
								key={se.id.toString()}
								className="animate-card-enter"
								style={{ animationDelay: `${i * 0.06}s` }}
							>
								<SplitCard splitEvent={se} participants={participants} debts={debts} />
							</div>
						);
					})}
					{addButton("Add split", () => setShowSplitModal(true))}
				</div>
			</section>

			{showDebtModal && <DebtModal onClose={() => setShowDebtModal(false)} />}
			{showSplitModal && <SplitModal onClose={() => setShowSplitModal(false)} />}
		</div>
	);
}
