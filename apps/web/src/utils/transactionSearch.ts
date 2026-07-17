import type { Transaction } from "./transactionFilters";

/**
 * Substring search across the visible row content of a transaction:
 * description, tag name, and both account names. Case-insensitive,
 * whitespace-trimmed. Returns true when the query is empty (no filtering).
 */
export function matchesTransactionSearch(
	tx: Transaction,
	query: string,
	accountsById: ReadonlyMap<string, string>,
	tagsById: ReadonlyMap<string, string>,
): boolean {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return true;

	const haystack: string[] = [];
	if (tx.description) haystack.push(tx.description);
	if (tx.tag_id) {
		const tag = tagsById.get(tx.tag_id);
		if (tag) haystack.push(tag);
	}
	if (tx.from_account_id) {
		const a = accountsById.get(tx.from_account_id);
		if (a) haystack.push(a);
	}
	if (tx.to_account_id) {
		const a = accountsById.get(tx.to_account_id);
		if (a) haystack.push(a);
	}
	for (const s of haystack) {
		if (s.toLowerCase().includes(needle)) return true;
	}
	return false;
}
