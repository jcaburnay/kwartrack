export type DebtDirection = "loaned" | "owed";

export type DebtRow = {
	id: string;
	personId: string;
	personName: string;
	direction: DebtDirection;
	amountCentavos: number;
	settledCentavos: number;
	tagId: string | null;
	tagName: string | null;
	date: string;
	description: string | null;
	splitId: string | null;
};

export type DebtSettledFilter = "all" | "settled" | "unsettled";

export type DebtFilters = {
	direction: DebtDirection | null;
	settled: DebtSettledFilter;
	personId: string | null;
	tagId: string | null;
	dateFrom: string | null;
	dateTo: string | null;
	query: string;
};

export const DEFAULT_DEBT_FILTERS: DebtFilters = {
	direction: null,
	settled: "all",
	personId: null,
	tagId: null,
	dateFrom: null,
	dateTo: null,
	query: "",
};

export function matchesDebtFilters(d: DebtRow, f: DebtFilters): boolean {
	if (f.direction != null && d.direction !== f.direction) return false;
	const fullySettled = d.settledCentavos >= d.amountCentavos;
	if (f.settled === "settled" && !fullySettled) return false;
	if (f.settled === "unsettled" && fullySettled) return false;
	if (f.personId != null && d.personId !== f.personId) return false;
	if (f.tagId != null && d.tagId !== f.tagId) return false;
	if (f.dateFrom != null && d.date < f.dateFrom) return false;
	if (f.dateTo != null && d.date > f.dateTo) return false;
	if (f.query.trim().length > 0) {
		const q = f.query.trim().toLowerCase();
		const haystack = `${d.personName} ${d.description ?? ""}`.toLowerCase();
		if (!haystack.includes(q)) return false;
	}
	return true;
}
