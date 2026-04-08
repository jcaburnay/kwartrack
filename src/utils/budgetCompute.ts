/**
 * Budget computation utility — shared by BudgetPage and TransactionModal.
 * Pure functions: no side effects, no SpacetimeDB imports.
 * All monetary values are BigInt centavos (i64 from SpacetimeDB).
 *
 * Pattern source: CONTEXT.md D-18, RESEARCH.md Pattern 4
 */

interface AllocationRow {
	tag: string;
	allocatedCentavos: bigint;
}

interface TransactionRow {
	type: string;
	tag: string;
	amountCentavos: bigint;
	date: { microsSinceUnixEpoch: bigint };
}

export interface TagBudgetStatus {
	tag: string;
	allocatedCentavos: bigint; // 0n = no allocation
	spentCentavos: bigint;
	remainingCentavos: bigint; // allocatedCentavos - spentCentavos (can be negative = over budget)
	percentUsed: number; // 0–100+; 0 when no allocation
	hasAllocation: boolean;
}

/**
 * Filters transactions to the current calendar month and groups expenses by tag.
 * Returns a Map<tag, totalSpentCentavos> for expense transactions only.
 *
 * D-10: All budget math happens client-side using subscribed my_transactions data.
 * D-18: Timestamp conversion uses microsSinceUnixEpoch / 1000n → ms for new Date().
 */
export function getCurrentMonthExpenses(
	transactions: readonly TransactionRow[],
): Map<string, bigint> {
	const now = new Date();
	const currentMonthTxns = transactions.filter((txn) => {
		const d = new Date(Number(txn.date.microsSinceUnixEpoch / 1000n));
		return (
			d.getFullYear() === now.getFullYear() &&
			d.getMonth() === now.getMonth() &&
			txn.type === "expense"
		);
	});

	const spentByTag = new Map<string, bigint>();
	for (const txn of currentMonthTxns) {
		spentByTag.set(txn.tag, (spentByTag.get(txn.tag) ?? 0n) + txn.amountCentavos);
	}
	return spentByTag;
}

/**
 * Maps each allocation row to a TagBudgetStatus, looking up spent amounts
 * from the spentByTag map produced by getCurrentMonthExpenses.
 *
 * D-18: percentUsed uses Math.round(Number(spent * 100n / allocated)) to avoid
 *       floating-point errors in BigInt division.
 */
export function computeTagStatuses(
	allocations: readonly AllocationRow[],
	spentByTag: Map<string, bigint>,
): TagBudgetStatus[] {
	return allocations.map((alloc) => {
		const spent = spentByTag.get(alloc.tag) ?? 0n;
		const remaining = alloc.allocatedCentavos - spent;
		const pct =
			alloc.allocatedCentavos > 0n
				? Math.round(Number((spent * 100n) / alloc.allocatedCentavos))
				: 0;
		return {
			tag: alloc.tag,
			allocatedCentavos: alloc.allocatedCentavos,
			spentCentavos: spent,
			remainingCentavos: remaining,
			percentUsed: pct,
			hasAllocation: true,
		};
	});
}
