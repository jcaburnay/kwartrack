import { useState } from "react";
import { useTable } from "spacetimedb/react";
import { NewItemCard } from "../components/NewItemCard";
import { RecurringCard } from "../components/RecurringCard";
import { RecurringModal } from "../components/RecurringModal";
import { tables } from "../module_bindings";

export function RecurringPage() {
	const [definitions, isReady] = useTable(tables.my_recurring_definitions);
	const [modalMode, setModalMode] = useState<"subscription" | "installment" | null>(null);

	if (!isReady) return null;

	const subscriptions = definitions.filter((d) => d.totalOccurrences === 0);
	const installments = definitions.filter((d) => d.totalOccurrences > 0);

	return (
		<div className="p-4 sm:p-6 space-y-8 ">
			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-5">
					SUBSCRIPTIONS
				</h2>
				{subscriptions.length === 0 && (
					<p className="text-sm text-base-content/60 mb-3">
						Recurring charges with no end date — streaming services, memberships, monthly bills.
					</p>
				)}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{subscriptions.map((def, i) => (
						<div key={def.id.toString()} className="" style={{ animationDelay: `${i * 0.06}s` }}>
							<RecurringCard definition={def} />
						</div>
					))}
					<NewItemCard label="New subscription" onClick={() => setModalMode("subscription")} />
				</div>
			</section>

			<section>
				<h2 className="text-xs font-semibold uppercase tracking-widest text-base-content/60 mb-5">
					INSTALLMENTS
				</h2>
				{installments.length === 0 && (
					<p className="text-sm text-base-content/60 mb-3">
						Fixed payments with an end date — loans, gadgets on installment, insurance plans.
					</p>
				)}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{installments.map((def, i) => (
						<div key={def.id.toString()} className="" style={{ animationDelay: `${i * 0.06}s` }}>
							<RecurringCard definition={def} />
						</div>
					))}
					<NewItemCard label="New installment" onClick={() => setModalMode("installment")} />
				</div>
			</section>

			{modalMode && <RecurringModal mode={modalMode} onClose={() => setModalMode(null)} />}
		</div>
	);
}
