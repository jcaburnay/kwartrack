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

export function daysRemaining(today: Date, timezone: string, monthYYYYMM: string): number {
	const current = currentMonthYYYYMM(today, timezone);
	if (monthYYYYMM < current) return 0;
	if (monthYYYYMM > current) return daysInMonth(monthYYYYMM);
	return Math.max(0, daysInMonth(monthYYYYMM) - dayOfMonth(today, timezone));
}

export function expectedSpendByToday(
	allocatedCentavos: number,
	today: Date,
	timezone: string,
	monthYYYYMM: string,
): number {
	if (allocatedCentavos <= 0) return 0;
	const current = currentMonthYYYYMM(today, timezone);
	if (monthYYYYMM < current) return allocatedCentavos;
	if (monthYYYYMM > current) return 0;
	const total = daysInMonth(monthYYYYMM);
	const day = dayOfMonth(today, timezone);
	return Math.min(allocatedCentavos, Math.round((allocatedCentavos * day) / total));
}

export function projectedEndOfMonth(
	actualCentavos: number,
	today: Date,
	timezone: string,
	monthYYYYMM: string,
): number {
	const current = currentMonthYYYYMM(today, timezone);
	if (monthYYYYMM < current) return actualCentavos;
	if (monthYYYYMM > current) return 0;
	const day = dayOfMonth(today, timezone);
	if (day <= 0) return 0;
	return Math.round((actualCentavos * daysInMonth(monthYYYYMM)) / day);
}

export function isEarlyMonth(today: Date, timezone: string, monthYYYYMM: string): boolean {
	const current = currentMonthYYYYMM(today, timezone);
	if (monthYYYYMM > current) return true;
	if (monthYYYYMM < current) return false;
	return dayOfMonth(today, timezone) <= EARLY_MONTH_DAYS;
}
