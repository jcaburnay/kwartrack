export type BudgetDateRange = { start_date: string; end_date: string };

function validDate(value: string): boolean {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		Number(value.slice(0, 4)) > 0 &&
		Number(value.slice(0, 4)) < 9999 &&
		!Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
		new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
	);
}

export function defaultBudgetEnd(start: string): string {
	if (!validDate(start)) return "";
	const [year, month, day] = start.split("-").map(Number);
	const last = new Date(Date.UTC(year, month + 1, 0));
	const end = new Date(Date.UTC(year, month, Math.min(day, last.getUTCDate())));
	return end.toISOString().slice(0, 10);
}

export function periodLabel(range: BudgetDateRange): string {
	const format = (iso: string) =>
		new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		}).format(new Date(`${iso}T00:00:00Z`));
	return `${format(range.start_date)} – ${format(range.end_date)}`;
}

export function activeBudgetPeriod<T extends BudgetDateRange>(
	periods: readonly T[],
	todayISO: string,
): T | null {
	return periods.find((p) => p.start_date <= todayISO && p.end_date >= todayISO) ?? null;
}

export function validateBudgetRange(
	range: BudgetDateRange,
	periods: readonly (BudgetDateRange & { id: string })[],
	editingId?: string,
): string | null {
	if (!validDate(range.start_date) || !validDate(range.end_date))
		return "Enter a valid start and end date.";
	if (range.end_date < range.start_date) return "End date must be on or after start date.";
	const overlap = periods.find(
		(p) => p.id !== editingId && p.start_date <= range.end_date && p.end_date >= range.start_date,
	);
	return overlap
		? `These dates overlap ${periodLabel(overlap)}. Choose dates outside that budget.`
		: null;
}

export function periodPacing(range: BudgetDateRange, todayISO: string) {
	const days = (a: string, b: string) =>
		Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
	const totalDays = days(range.start_date, range.end_date) + 1;
	const elapsedDays = Math.min(totalDays, Math.max(0, days(range.start_date, todayISO) + 1));
	return { totalDays, elapsedDays, daysLeft: totalDays - elapsedDays };
}
