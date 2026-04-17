import type { Timestamp } from "spacetimedb";

/**
 * Converts a SpacetimeDB Timestamp to a JavaScript Date.
 * Timestamps store microseconds since the Unix epoch as a BigInt;
 * Date expects milliseconds as a Number.
 */
export function fromTimestamp(ts: Timestamp): Date {
	return new Date(Number(ts.microsSinceUnixEpoch / 1000n));
}

/**
 * Formats a Date as a "YYYY-MM-DD" string using UTC.
 * Use this when converting a stored Timestamp (which round-trips through UTC
 * midnight via <input type="date"> → new Date(iso) → Timestamp) back to an
 * input-date string. Matches the pre-existing `.toISOString().slice(0, 10)`
 * pattern used for edit-mode date defaults across modals.
 */
export function toISODate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * Returns today's date as a "YYYY-MM-DD" string in the user's LOCAL calendar.
 * Suitable for new-item date defaults.
 *
 * Deliberately LOCAL (not UTC) — matches TransactionModal's original inline
 * helper. A user in Asia/Manila opening the modal at 1 AM local should see
 * today's date, not yesterday's. This differs from toISODate which uses UTC
 * because its callers are formatting stored UTC-midnight Timestamps.
 */
export function todayISO(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
