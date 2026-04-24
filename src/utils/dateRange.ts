/**
 * Compute the calendar-month bounds in the user's timezone. Used by the cash /
 * e-wallet / savings detail strip to sum "this month" inflow + outflow.
 *
 * Returns YYYY-MM-DD strings; transaction `date` is a DATE column so string
 * comparison against these bounds works.
 */

export type MonthBounds = {
	startISO: string; // inclusive
	endExclusiveISO: string; // exclusive (1st of next month)
	monthLabel: string; // "April 2026"
};

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** Build a YYYY-MM-DD string in a specific IANA timezone from a given instant. */
function ymdInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const parts = fmt.formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return {
		year: Number(get("year")),
		month: Number(get("month")),
		day: Number(get("day")),
	};
}

export function monthBounds(timezone: string, today: Date = new Date()): MonthBounds {
	const { year, month } = ymdInTimezone(today, timezone);
	const startISO = `${year}-${pad(month)}-01`;
	const nextMonthYear = month === 12 ? year + 1 : year;
	const nextMonth = month === 12 ? 1 : month + 1;
	const endExclusiveISO = `${nextMonthYear}-${pad(nextMonth)}-01`;
	const monthLabel = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "long",
	}).format(new Date(`${startISO}T12:00:00Z`));
	return { startISO, endExclusiveISO, monthLabel };
}
