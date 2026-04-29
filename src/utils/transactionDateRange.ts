import { monthBounds, shiftDaysISO, ymdISO } from "./dateRange";

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

export function resolveDateRangePreset(
	preset: DateRangePreset,
	timezone: string,
	today: Date = new Date(),
): ResolvedRange {
	if (preset === "custom" || preset === "all-time") return { from: null, to: null };

	const todayStr = ymdISO(today, timezone);

	if (preset === "this-month") {
		const { startISO } = monthBounds(timezone, today);
		return { from: startISO, to: todayStr };
	}

	if (preset === "last-30-days") {
		return { from: shiftDaysISO(todayStr, -29), to: todayStr };
	}

	// last-month — derive bounds via monthBounds + day arithmetic for consistency
	// with the rest of the codebase's calendar math.
	const thisMonthStart = monthBounds(timezone, today).startISO;
	const to = shiftDaysISO(thisMonthStart, -1);
	const from = monthBounds(timezone, new Date(`${to}T12:00:00Z`)).startISO;
	return { from, to };
}
