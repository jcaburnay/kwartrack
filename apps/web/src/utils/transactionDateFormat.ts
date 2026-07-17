/**
 * Compact date format for the Transactions activity feed.
 * - "Today" / "Yesterday" for the last two calendar days in the user's timezone.
 * - "Apr 28" for older dates in the current year.
 * - "Apr 28, 2025" for dates in a different year.
 *
 * `iso` is a transaction's `date` (a YYYY-MM-DD DATE column).
 */
import { shiftDaysISO, ymdISO } from "./dateRange";

export function formatTransactionDate(iso: string, today: Date, timezone: string): string {
	const todayStr = ymdISO(today, timezone);
	if (iso === todayStr) return "Today";
	if (iso === shiftDaysISO(todayStr, -1)) return "Yesterday";

	const parsed = new Date(`${iso}T12:00:00Z`);
	const todayYear = Number(todayStr.slice(0, 4));
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
