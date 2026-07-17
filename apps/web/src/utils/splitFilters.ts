import type { SplitMethod } from "./splitMath";

export type SplitProgressFilter = "all" | "not-settled" | "partially-settled" | "fully-settled";

export type SplitRow = {
	id: string;
	description: string;
	totalCentavos: number;
	userShareCentavos: number;
	paidFromAccountId: string;
	tagId: string;
	tagName: string;
	method: SplitMethod;
	date: string;
	participantCount: number;
	settledCount: number;
	participantNames: string[];
};

export type SplitFilters = {
	tagId: string | null;
	method: SplitMethod | null;
	progress: SplitProgressFilter;
	dateFrom: string | null;
	dateTo: string | null;
	query: string;
};

export const DEFAULT_SPLIT_FILTERS: SplitFilters = {
	tagId: null,
	method: null,
	progress: "all",
	dateFrom: null,
	dateTo: null,
	query: "",
};

export function matchesSplitFilters(s: SplitRow, f: SplitFilters): boolean {
	if (f.tagId != null && s.tagId !== f.tagId) return false;
	if (f.method != null && s.method !== f.method) return false;
	if (f.dateFrom != null && s.date < f.dateFrom) return false;
	if (f.dateTo != null && s.date > f.dateTo) return false;
	if (f.progress === "not-settled" && s.settledCount > 0) return false;
	if (f.progress === "fully-settled" && s.settledCount !== s.participantCount) return false;
	if (
		f.progress === "partially-settled" &&
		(s.settledCount === 0 || s.settledCount === s.participantCount)
	) {
		return false;
	}
	if (f.query.trim().length > 0) {
		const q = f.query.trim().toLowerCase();
		const hay = `${s.description} ${s.participantNames.join(" ")}`.toLowerCase();
		if (!hay.includes(q)) return false;
	}
	return true;
}
