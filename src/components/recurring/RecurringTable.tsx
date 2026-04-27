import { Check, Pause } from "lucide-react";
import type { Tag } from "../../hooks/useTags";
import type { Account } from "../../utils/accountBalances";
import { formatCentavos } from "../../utils/currency";
import type { Recurring } from "../../utils/recurringFilters";
import { statusOf } from "../../utils/recurringFilters";
import { RecurringRowActions } from "./RecurringRowActions";

type Props = {
	recurrings: readonly Recurring[];
	accounts: readonly Account[];
	tags: readonly Tag[];
	onEdit: (r: Recurring) => void;
	onTogglePaused: (id: string, currentlyPaused: boolean) => Promise<{ error: string | null }>;
	onDelete: (id: string) => Promise<{ error: string | null }>;
};

const INTERVAL_LABEL: Record<Recurring["interval"], string> = {
	weekly: "Weekly",
	monthly: "Monthly",
	quarterly: "Quarterly",
	semi_annual: "Semi-annual",
	annual: "Annual",
};

const TYPE_BADGE_CLASS: Record<Recurring["type"], string> = {
	expense: "badge-error",
	income: "badge-success",
	transfer: "badge-info",
};

function statusIcon(r: Recurring) {
	const status = statusOf(r);
	if (status === "paused") {
		return <Pause className="w-3.5 h-3.5 text-base-content/60" aria-label="Paused" />;
	}
	if (status === "completed") {
		return <Check className="w-3.5 h-3.5 text-success" aria-label="Completed" />;
	}
	return null;
}

function formatScheduleLocal(iso: string): string {
	const d = new Date(iso);
	return new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(d);
}

export function RecurringTable({
	recurrings,
	accounts,
	tags,
	onEdit,
	onTogglePaused,
	onDelete,
}: Props) {
	const accountById = new Map(accounts.map((a) => [a.id, a]));
	const tagById = new Map(tags.map((t) => [t.id, t]));

	if (recurrings.length === 0) {
		return (
			<div className="bg-base-100 rounded-box border border-base-300 p-8 text-center text-base-content/60 text-sm italic">
				No recurring transactions yet. Add subscriptions, installments, or salary via the + button.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto bg-base-100 rounded-box border border-base-300">
			<table className="table table-sm">
				<thead>
					<tr>
						<th></th>
						<th>Service</th>
						<th className="text-right">Amount</th>
						<th>Type</th>
						<th>Tag</th>
						<th>From</th>
						<th>To</th>
						<th>Schedule</th>
						<th>Interval</th>
						<th className="text-right">Remaining</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{recurrings.map((r) => {
						const isCompleted = r.is_completed;
						const isPaused = r.is_paused;
						return (
							<tr
								key={r.id}
								data-row-id={r.id}
								className={isCompleted || isPaused ? "opacity-60" : undefined}
							>
								<td>{statusIcon(r)}</td>
								<td className="font-medium">{r.service}</td>
								<td className="text-right">{formatCentavos(r.amount_centavos)}</td>
								<td>
									<span className={`badge badge-sm ${TYPE_BADGE_CLASS[r.type]}`}>{r.type}</span>
								</td>
								<td className="text-sm text-base-content/70">
									{r.tag_id ? (tagById.get(r.tag_id)?.name ?? "—") : "—"}
								</td>
								<td className="text-sm text-base-content/70">
									{r.from_account_id ? (accountById.get(r.from_account_id)?.name ?? "—") : "—"}
								</td>
								<td className="text-sm text-base-content/70">
									{r.to_account_id ? (accountById.get(r.to_account_id)?.name ?? "—") : "—"}
								</td>
								<td className="text-sm">{formatScheduleLocal(r.next_occurrence_at)}</td>
								<td className="text-sm">{INTERVAL_LABEL[r.interval]}</td>
								<td className="text-right text-sm">
									{r.remaining_occurrences == null ? "—" : r.remaining_occurrences}
								</td>
								<td className="text-right">
									<RecurringRowActions
										recurring={r}
										onEdit={onEdit}
										onTogglePaused={onTogglePaused}
										onDelete={onDelete}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
