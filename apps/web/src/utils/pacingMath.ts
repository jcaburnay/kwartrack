import { type BudgetDateRange, periodPacing } from "./budgetPeriod";
import { ymdISO } from "./dateRange";

const EARLY_MONTH_DAYS = 2;

export function daysInMonth(monthYYYYMM: string): number {
	const [yStr, mStr] = monthYYYYMM.split("-");
	const y = Number(yStr);
	const m = Number(mStr);
	// Day 0 of next month == last day of this month.
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function dayOfMonth(today: Date, timezone: string): number {
	const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, day: "2-digit" });
	return Number(fmt.format(today));
}

export function currentMonthYYYYMM(today: Date, timezone: string): string {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
	});
	const parts = fmt.formatToParts(today);
	const y = parts.find((p) => p.type === "year")?.value ?? "";
	const m = parts.find((p) => p.type === "month")?.value ?? "";
	return `${y}-${m}`;
}

function pacingRange(value: string | BudgetDateRange): BudgetDateRange {
	if (typeof value !== "string") return value;
	return {
		start_date: `${value}-01`,
		end_date: `${value}-${String(daysInMonth(value)).padStart(2, "0")}`,
	};
}

export function daysRemaining(
	today: Date,
	timezone: string,
	period: string | BudgetDateRange,
): number {
	return periodPacing(pacingRange(period), ymdISO(today, timezone)).daysLeft;
}
export function expectedSpendByToday(
	allocatedCentavos: number,
	today: Date,
	timezone: string,
	period: string | BudgetDateRange,
): number {
	if (allocatedCentavos <= 0) return 0;
	const { totalDays, elapsedDays } = periodPacing(pacingRange(period), ymdISO(today, timezone));
	return Math.round((allocatedCentavos * elapsedDays) / totalDays);
}
export function projectedEndOfMonth(
	actualCentavos: number,
	today: Date,
	timezone: string,
	period: string | BudgetDateRange,
): number {
	const { totalDays, elapsedDays } = periodPacing(pacingRange(period), ymdISO(today, timezone));
	return elapsedDays === 0 ? 0 : Math.round((actualCentavos * totalDays) / elapsedDays);
}
export function isEarlyMonth(
	today: Date,
	timezone: string,
	period: string | BudgetDateRange,
): boolean {
	const range = pacingRange(period);
	if (ymdISO(today, timezone) > range.end_date) return false;
	return periodPacing(range, ymdISO(today, timezone)).elapsedDays <= EARLY_MONTH_DAYS;
}
