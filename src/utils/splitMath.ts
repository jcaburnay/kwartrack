/**
 * Pure rounding logic for the four split methods. All amounts are centavos
 * (integer). The user-the-payer is at index 0 and absorbs any rounding
 * remainder (spec §652).
 *
 * Returns null when the user input is internally inconsistent (e.g. exact
 * shares don't sum to total, percentages don't sum to 100, shares ≤ 0).
 * Callers translate `null` into a friendly form-level error.
 */
export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export type SplitMathInput = {
	method: SplitMethod;
	totalCentavos: number;
	rows: { input: number | null }[];
};

export function computeShareCentavos(args: SplitMathInput): number[] | null {
	const { method, totalCentavos, rows } = args;
	if (rows.length === 0) return null;
	if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) return null;

	if (method === "equal") {
		const base = Math.floor(totalCentavos / rows.length);
		const out = rows.map(() => base);
		const remainder = totalCentavos - base * rows.length;
		out[0] += remainder;
		return out;
	}

	if (method === "exact") {
		const out: number[] = [];
		let sum = 0;
		for (const row of rows) {
			if (row.input == null || !Number.isInteger(row.input) || row.input < 0) return null;
			out.push(row.input);
			sum += row.input;
		}
		if (sum !== totalCentavos) return null;
		return out;
	}

	if (method === "percentage") {
		const pcts: number[] = [];
		let pctSum = 0;
		for (const row of rows) {
			if (row.input == null || !Number.isFinite(row.input) || row.input <= 0) return null;
			pcts.push(row.input);
			pctSum += row.input;
		}
		// Allow tiny float slop (0.01) — UI rounds to 2dp.
		if (Math.abs(pctSum - 100) > 0.01) return null;
		const out = pcts.map((p) => Math.round((totalCentavos * p) / 100));
		const remainder = totalCentavos - out.reduce((a, b) => a + b, 0);
		out[0] += remainder;
		return out;
	}

	// shares
	const counts: number[] = [];
	let countSum = 0;
	for (const row of rows) {
		if (row.input == null || !Number.isInteger(row.input) || row.input <= 0) return null;
		counts.push(row.input);
		countSum += row.input;
	}
	const out = counts.map((c) => Math.floor((totalCentavos * c) / countSum));
	const remainder = totalCentavos - out.reduce((a, b) => a + b, 0);
	out[0] += remainder;
	return out;
}
