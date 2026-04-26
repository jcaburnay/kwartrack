/**
 * Pure predicates used by the Recurring table. Kept standalone so the filter
 * bar, table, and tests can compose them without re-implementing.
 */
import type { Database } from "../types/supabase";
import type { RecurringInterval } from "./recurringValidation";
import type { TransactionType } from "./transactionValidation";

export type Recurring = Database["public"]["Tables"]["recurring"]["Row"];
export type RecurringStatus = "active" | "paused" | "completed";

export type RecurringFilters = {
	statuses: ReadonlySet<RecurringStatus>;
	type: TransactionType | null;
	accountId: string | null;
	tagId: string | null;
	interval: RecurringInterval | null;
	search: string;
};

export const DEFAULT_RECURRING_FILTERS: RecurringFilters = {
	statuses: new Set(["active", "paused"]),
	type: null,
	accountId: null,
	tagId: null,
	interval: null,
	search: "",
};

export function statusOf(r: Recurring): RecurringStatus {
	if (r.is_completed) return "completed";
	if (r.is_paused) return "paused";
	return "active";
}

export function matchesRecurringFilters(r: Recurring, f: RecurringFilters): boolean {
	if (f.statuses.size > 0 && !f.statuses.has(statusOf(r))) return false;
	if (f.type != null && r.type !== f.type) return false;
	if (f.accountId != null && r.from_account_id !== f.accountId && r.to_account_id !== f.accountId) {
		return false;
	}
	if (f.tagId != null && r.tag_id !== f.tagId) return false;
	if (f.interval != null && r.interval !== f.interval) return false;
	const needle = f.search.trim().toLowerCase();
	if (needle && !r.service.toLowerCase().includes(needle)) return false;
	return true;
}
