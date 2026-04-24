/**
 * Pure predicates used by the Transactions table. Kept standalone so the
 * filter bar, table, and tests can compose them without re-implementing.
 */
import type { Database } from "../types/supabase";
import type { TransactionType } from "./transactionValidation";

export type Transaction = Database["public"]["Tables"]["transaction"]["Row"];

export type TransactionFilters = {
	type: TransactionType | null;
	tagId: string | null;
	accountId: string | null;
	groupId: string | null;
	dateFrom: string | null;
	dateTo: string | null; // inclusive
};

export const EMPTY_FILTERS: TransactionFilters = {
	type: null,
	tagId: null,
	accountId: null,
	groupId: null,
	dateFrom: null,
	dateTo: null,
};

export type AccountLookup = {
	id: string;
	groupId: string | null;
};

export function matchesFilters(
	tx: Transaction,
	filters: TransactionFilters,
	accountsById: ReadonlyMap<string, AccountLookup>,
): boolean {
	if (filters.type != null && tx.type !== filters.type) return false;
	if (filters.tagId != null && tx.tag_id !== filters.tagId) return false;

	if (filters.accountId != null) {
		if (tx.from_account_id !== filters.accountId && tx.to_account_id !== filters.accountId) {
			return false;
		}
	}

	if (filters.groupId != null) {
		const fromGroup = tx.from_account_id
			? (accountsById.get(tx.from_account_id)?.groupId ?? null)
			: null;
		const toGroup = tx.to_account_id ? (accountsById.get(tx.to_account_id)?.groupId ?? null) : null;
		if (fromGroup !== filters.groupId && toGroup !== filters.groupId) return false;
	}

	if (filters.dateFrom != null && tx.date < filters.dateFrom) return false;
	if (filters.dateTo != null && tx.date > filters.dateTo) return false;
	return true;
}
