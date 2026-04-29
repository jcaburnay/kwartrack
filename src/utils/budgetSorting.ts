import { isEarlyMonth, projectedEndOfMonth } from "./pacingMath";

export type SortableRow = {
	tagId: string;
	tagName: string;
	allocated: number;
	actual: number;
};

function riskScore(row: SortableRow, today: Date, timezone: string, monthYYYYMM: string): number {
	if (row.allocated <= 0) return Number.NEGATIVE_INFINITY;
	if (isEarlyMonth(today, timezone, monthYYYYMM)) {
		return row.actual / row.allocated;
	}
	return projectedEndOfMonth(row.actual, today, timezone, monthYYYYMM) / row.allocated;
}

export function sortByOvershootRisk(
	rows: readonly SortableRow[],
	today: Date,
	timezone: string,
	monthYYYYMM: string,
): SortableRow[] {
	return [...rows].sort((a, b) => {
		const ra = riskScore(a, today, timezone, monthYYYYMM);
		const rb = riskScore(b, today, timezone, monthYYYYMM);
		if (ra !== rb) return rb - ra;
		return a.tagName.localeCompare(b.tagName);
	});
}
