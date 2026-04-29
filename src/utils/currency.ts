/**
 * kwartrack stores centavos as integers (BIGINT in Postgres). Helpers here
 * bridge the user-facing peso form fields and the centavo integers stored
 * everywhere else. 1 peso = 100 centavos.
 */

export const PHP = new Intl.NumberFormat("en-PH", {
	style: "currency",
	currency: "PHP",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function formatCentavos(centavos: number): string {
	return PHP.format(centavos / 100);
}

export function pesosToCentavos(pesos: number): number {
	if (!Number.isFinite(pesos)) return Number.NaN;
	return Math.round(pesos * 100);
}

export function centavosToPesos(centavos: number): number {
	return centavos / 100;
}

/**
 * Compact currency formatter for chart axis ticks where space is tight.
 * Shows "₱1.5k" for thousands, "₱2.4M" for millions, "₱0" for zero, and full
 * formatting for small values. Negatives keep the leading sign. Always uses
 * a thin `₱` prefix so the unit reads at a glance even on a 64px-wide axis.
 */
export function formatCentavosCompact(centavos: number): string {
	const sign = centavos < 0 ? "-" : "";
	const abs = Math.abs(centavos) / 100;
	if (abs === 0) return "₱0";
	if (abs >= 1_000_000) return `${sign}₱${trimZero(abs / 1_000_000)}M`;
	if (abs >= 1_000) return `${sign}₱${trimZero(abs / 1_000)}k`;
	if (abs >= 1) return `${sign}₱${trimZero(abs)}`;
	return `${sign}₱${abs.toFixed(2)}`;
}

function trimZero(n: number): string {
	const fixed = n.toFixed(1);
	return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}
