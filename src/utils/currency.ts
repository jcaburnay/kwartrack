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
