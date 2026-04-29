/**
 * Compact date format for the Transactions activity feed.
 * - "Today" / "Yesterday" for the last two calendar days in the user's timezone.
 * - "Apr 28" for older dates in the current year.
 * - "Apr 28, 2025" for dates in a different year.
 *
 * `iso` is a transaction's `date` (a YYYY-MM-DD DATE column).
 */
function ymdInTz(date: Date, timezone: string): string {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return fmt.format(date); // YYYY-MM-DD
}

function shiftDays(iso: string, delta: number): string {
	const d = new Date(`${iso}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

export function formatTransactionDate(iso: string, today: Date, timezone: string): string {
	const todayISO = ymdInTz(today, timezone);
	if (iso === todayISO) return "Today";
	if (iso === shiftDays(todayISO, -1)) return "Yesterday";

	const parsed = new Date(`${iso}T12:00:00Z`);
	const todayYear = Number(todayISO.slice(0, 4));
	const txYear = parsed.getUTCFullYear();
	if (txYear === todayYear) {
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		}).format(parsed);
	}
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
}
