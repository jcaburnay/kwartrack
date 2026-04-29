import { monthBounds } from "./dateRange";

export type DateRangePreset = "this-month" | "last-30-days" | "last-month" | "custom" | "all-time";

export type ResolvedRange = {
	from: string | null;
	to: string | null;
};

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
	{ value: "this-month", label: "This month" },
	{ value: "last-30-days", label: "Last 30 days" },
	{ value: "last-month", label: "Last month" },
	{ value: "all-time", label: "All time" },
	{ value: "custom", label: "Custom…" },
];

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

function todayISO(timezone: string, today: Date): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(today);
}

function shiftDaysISO(iso: string, delta: number): string {
	const d = new Date(`${iso}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

export function resolveDateRangePreset(
	preset: DateRangePreset,
	timezone: string,
	today: Date = new Date(),
): ResolvedRange {
	if (preset === "custom" || preset === "all-time") return { from: null, to: null };

	const todayStr = todayISO(timezone, today);

	if (preset === "this-month") {
		const { startISO } = monthBounds(timezone, today);
		return { from: startISO, to: todayStr };
	}

	if (preset === "last-30-days") {
		return { from: shiftDaysISO(todayStr, -29), to: todayStr };
	}

	// last-month
	const [y, m] = todayStr.split("-").map(Number);
	const prevYear = m === 1 ? y - 1 : y;
	const prevMonth = m === 1 ? 12 : m - 1;
	const from = `${prevYear}-${pad(prevMonth)}-01`;
	// last day of previous month = day 0 of current month
	const lastDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
	const to = `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`;
	return { from, to };
}
