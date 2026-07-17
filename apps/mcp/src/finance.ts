import type { Account, BudgetStatus } from "./types.js";

export function formatPhp(centavos: number) {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		minimumFractionDigits: 2,
	}).format(centavos / 100);
}

export function monthInTimezone(date: Date, timezone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	if (!year || !month) throw new Error("Could not resolve the current month");
	return `${year}-${month}`;
}

export function dateInTimezone(date: Date, timezone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	if (!year || !month || !day) throw new Error("Could not resolve the local date");
	return `${year}-${month}-${day}`;
}

export function summarizeAccounts(accounts: Account[]) {
	let assetsCentavos = 0;
	let liabilitiesCentavos = 0;
	for (const account of accounts) {
		if (account.isArchived) continue;
		if (account.type === "credit") liabilitiesCentavos += account.balanceCentavos;
		else assetsCentavos += account.balanceCentavos;
	}
	return {
		assetsCentavos,
		liabilitiesCentavos,
		netWorthCentavos: assetsCentavos - liabilitiesCentavos,
	};
}

export function budgetRemaining(status: BudgetStatus) {
	return status.overallBudgetCentavos - status.overallActualCentavos;
}

export function addDays(date: Date, days: number) {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}
