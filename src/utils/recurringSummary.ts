import { type Recurring, statusOf } from "./recurringFilters";

export type RecurringSummary = {
	activeCount: number;
	pausedCount: number;
	completedCount: number;
	monthlyOutflowCentavos: number;
	nextDue: { service: string; date: string } | null;
};

const MONTHLY_FACTOR: Record<Recurring["interval"], number> = {
	weekly: 4.345,
	monthly: 1,
	quarterly: 1 / 3,
	semi_annual: 1 / 6,
	annual: 1 / 12,
};

function isOutflow(r: Recurring): boolean {
	return r.type === "expense" || r.type === "transfer";
}

export function summariseRecurrings(recurrings: readonly Recurring[]): RecurringSummary {
	let activeCount = 0;
	let pausedCount = 0;
	let completedCount = 0;
	let monthlyOutflowCentavos = 0;
	let nextDue: { service: string; date: string } | null = null;

	for (const r of recurrings) {
		const status = statusOf(r);
		if (status === "active") {
			activeCount += 1;
			if (isOutflow(r)) {
				monthlyOutflowCentavos += Math.round(r.amount_centavos * MONTHLY_FACTOR[r.interval]);
			}
			if (r.next_occurrence_at) {
				if (!nextDue || r.next_occurrence_at < nextDue.date) {
					nextDue = { service: r.service, date: r.next_occurrence_at };
				}
			}
		} else if (status === "paused") {
			pausedCount += 1;
		} else {
			completedCount += 1;
		}
	}

	return { activeCount, pausedCount, completedCount, monthlyOutflowCentavos, nextDue };
}
