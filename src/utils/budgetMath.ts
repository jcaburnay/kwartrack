import type { Transaction } from "./transactionFilters";

export type ActualsByTag = Map<string, number>;

// TODO: subtract participant shares once splits ship (Slice 10).
//   For split-linked expenses, only the user's share contributes — see
//   specs_v2.md §Budget rule on splits.
export function computeActualsByTag(
	transactions: readonly Transaction[],
	monthYYYYMM: string,
): ActualsByTag {
	const actuals: ActualsByTag = new Map();
	for (const tx of transactions) {
		if (tx.type !== "expense") continue;
		if (!tx.tag_id) continue;
		if (tx.date.slice(0, 7) !== monthYYYYMM) continue;
		actuals.set(tx.tag_id, (actuals.get(tx.tag_id) ?? 0) + tx.amount_centavos);
	}
	return actuals;
}

export function computeOthersCentavos(
	actuals: ActualsByTag,
	allocatedTagIds: ReadonlySet<string>,
): number {
	let total = 0;
	for (const [tagId, cents] of actuals) {
		if (!allocatedTagIds.has(tagId)) total += cents;
	}
	return total;
}

export function computeOverallActualCentavos(actuals: ActualsByTag): number {
	let total = 0;
	for (const cents of actuals.values()) total += cents;
	return total;
}

export type ProgressBucket = "empty" | "green" | "orange" | "red";

export function progressBucket(actual: number, budget: number): ProgressBucket {
	if (budget <= 0) return "empty";
	const pct = (actual / budget) * 100;
	if (pct > 100) return "red";
	if (pct >= 80) return "orange";
	return "green";
}
