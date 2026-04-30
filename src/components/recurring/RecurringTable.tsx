import { Check, Pause } from "lucide-react";
import type { ReactNode } from "react";
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
	weekly: "weekly",
	monthly: "monthly",
	quarterly: "quarterly",
	semi_annual: "semi-annual",
	annual: "annual",
};

function statusGlyph(r: Recurring) {
	const status = statusOf(r);
	if (status === "paused") {
		return <Pause className="w-3.5 h-3.5 text-base-content/50" aria-label="Paused" />;
	}
	if (status === "completed") {
		return <Check className="w-3.5 h-3.5 text-base-content/50" aria-label="Completed" />;
	}
	return null;
}

function formatScheduleDate(iso: string): string {
	const target = new Date(iso);
	const today = new Date();
	const sameYear = target.getFullYear() === today.getFullYear();
	const dayDiff = Math.round(
		(new Date(target.toDateString()).getTime() - new Date(today.toDateString()).getTime()) /
			86_400_000,
	);
	if (dayDiff === 0) return "Today";
	if (dayDiff === -1) return "Yesterday";
	const opts: Intl.DateTimeFormatOptions = sameYear
		? { month: "short", day: "numeric" }
		: { month: "short", day: "numeric", year: "numeric" };
	return new Intl.DateTimeFormat("en-US", opts).format(target);
}

function signedAmount(r: Recurring): string {
	const formatted = formatCentavos(r.amount_centavos);
	if (r.type === "income") return `+${formatted}`;
	return `-${formatted}`;
}

function renderAccount(r: Recurring, accountById: Map<string, Account>): ReactNode {
	const fromName = r.from_account_id ? accountById.get(r.from_account_id)?.name : null;
	const toName = r.to_account_id ? accountById.get(r.to_account_id)?.name : null;
	if (r.type === "expense") return fromName ?? "—";
	if (r.type === "income") return toName ?? "—";
	if (fromName && toName) return `${fromName} → ${toName}`;
	return "—";
}

function scheduleSubLine(r: Recurring): string {
	const status = statusOf(r);
	if (status === "completed") return "Completed";
	const interval = INTERVAL_LABEL[r.interval];
	if (r.remaining_occurrences != null && r.remaining_occurrences > 0) {
		return `${interval} · ${r.remaining_occurrences} left`;
	}
	return interval;
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
			<div className="border border-dashed border-base-300 p-8 text-center text-base-content/60 text-sm">
				No recurrings yet. Use + New to add a subscription, installment, or salary.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="table table-sm text-xs">
				<thead>
					<tr className="text-base-content/60">
						<th className="sticky left-0 z-10 bg-base-100 whitespace-nowrap">Service</th>
						<th className="text-right whitespace-nowrap">Amount</th>
						<th className="hidden md:table-cell">Tag</th>
						<th className="hidden md:table-cell">Account</th>
						<th>Schedule</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{recurrings.map((r) => {
						const dimmed = r.is_paused || r.is_completed;
						const subLine = scheduleSubLine(r);
						return (
							<tr key={r.id} data-row-id={r.id} className={dimmed ? "opacity-60" : undefined}>
								<td className="sticky left-0 z-10 bg-base-100 whitespace-nowrap">
									<div className="flex items-center gap-1.5">
										{statusGlyph(r)}
										<span className="font-medium">{r.service}</span>
									</div>
								</td>
								<td className="text-right tabular-nums whitespace-nowrap">
									<div className={r.type === "income" ? "text-success" : undefined}>
										{signedAmount(r)}
									</div>
									{r.fee_centavos != null && (
										<div className="text-base-content/50">
											+{formatCentavos(r.fee_centavos)} fee
										</div>
									)}
								</td>
								<td className="hidden md:table-cell whitespace-nowrap">
									{r.tag_id ? (tagById.get(r.tag_id)?.name ?? "—") : "—"}
								</td>
								<td className="hidden md:table-cell whitespace-nowrap">
									{renderAccount(r, accountById)}
								</td>
								<td>
									<div className="tabular-nums">{formatScheduleDate(r.next_occurrence_at)}</div>
									<div className="text-base-content/50">{subLine}</div>
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
