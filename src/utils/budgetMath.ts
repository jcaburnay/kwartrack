export type ActualsByTag = Map<string, number>;

/**
 * One row contributing to a tag's monthly actual. For non-split-linked
 * expenses `effectiveCentavos` equals `amount_centavos`; for split-linked
 * rows it's `split_event.user_share_centavos` (the user's slice).
 */
export type ActualRow = {
	tagId: string | null;
	effectiveCentavos: number;
	date: string;
};

export function computeActualsByTag(
	rows: readonly ActualRow[],
	monthYYYYMM: string,
): ActualsByTag {
	const actuals: ActualsByTag = new Map();
	for (const r of rows) {
		if (!r.tagId) continue;
		if (r.date.slice(0, 7) !== monthYYYYMM) continue;
		actuals.set(r.tagId, (actuals.get(r.tagId) ?? 0) + r.effectiveCentavos);
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
