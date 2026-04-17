/**
 * Formats a centavos BigInt as Philippine peso string per D-16.
 * Uses Intl.NumberFormat with en-PH locale for comma separators.
 *
 * formatPesos(0n)        => "P0.00"
 * formatPesos(500n)      => "P5.00"
 * formatPesos(12050000n) => "P120,500.00"
 */
export function formatPesos(centavos: bigint): string {
	const pesos = Number(centavos) / 100;
	return (
		"P" +
		pesos.toLocaleString("en-PH", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
	);
}

/**
 * Converts a peso amount (string or number) to centavos BigInt.
 * Matches the inline `BigInt(Math.round(parseFloat(x) * 100))` pattern
 * used throughout modal submit handlers.
 *
 * Returns 0n for empty, whitespace, or NaN-producing input.
 * Rounds to the nearest centavo via Math.round — values like "12.005"
 * may round inconsistently due to IEEE-754 representation; this matches
 * the pre-existing inline behavior.
 * Note: parseFloat tolerates trailing non-numeric characters (e.g., "12.5abc"
 * yields 1250n), so callers must validate input shape separately.
 */
export function toCentavos(amount: string | number): bigint {
	const s = typeof amount === "number" ? amount.toString() : amount.trim();
	if (s === "") return 0n;
	const n = parseFloat(s);
	if (Number.isNaN(n)) return 0n;
	return BigInt(Math.round(n * 100));
}

/**
 * Converts centavos to a peso number. Useful for chart/data transforms
 * where numeric math is needed. For user-facing display, use formatPesos.
 */
export function fromCentavos(centavos: bigint): number {
	return Number(centavos) / 100;
}

/**
 * Formats centavos as a "XX.XX" peso string suitable for populating
 * form field defaults in edit flows. Replaces the inline
 * `(Number(x) / 100).toFixed(2)` pattern.
 */
export function toAmountString(centavos: bigint): string {
	return (Number(centavos) / 100).toFixed(2);
}
