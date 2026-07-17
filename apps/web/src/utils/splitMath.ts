/**
 * Per-participant share math for the four split methods. All amounts are
 * centavos (integer).
 *
 * Contract: `rows` is the array of **non-payer participants only**. The
 * function returns one centavos value per participant; the caller derives
 * the user-the-payer's share as `totalCentavos − Σ(returned)` (spec §692).
 * The payer always absorbs the rounding residual because each method only
 * ever rounds down (or to-nearest), never up — so the residual is ≥ 0.
 *
 * Returns null when the user input is internally inconsistent (e.g. exact
 * shares exceed total, percentages exceed 100, shares ≤ 0). Callers
 * translate `null` into a friendly form-level error.
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
		// Payer counts as one more participant; floor each, residual lands on
		// the payer via the caller.
		const base = Math.floor(totalCentavos / (rows.length + 1));
		return rows.map(() => base);
	}

	if (method === "exact") {
		const out: number[] = [];
		let sum = 0;
		for (const row of rows) {
			if (row.input == null || !Number.isInteger(row.input) || row.input <= 0) return null;
			out.push(row.input);
			sum += row.input;
		}
		if (sum > totalCentavos) return null;
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
		if (pctSum - 100 > 0.01) return null;
		return pcts.map((p) => Math.round((totalCentavos * p) / 100));
	}

	// shares — payer has implicit weight 1, divisor = 1 + Σw.
	const counts: number[] = [];
	let countSum = 0;
	for (const row of rows) {
		if (row.input == null || !Number.isInteger(row.input) || row.input <= 0) return null;
		counts.push(row.input);
		countSum += row.input;
	}
	const divisor = 1 + countSum;
	return counts.map((c) => Math.floor((totalCentavos * c) / divisor));
}
