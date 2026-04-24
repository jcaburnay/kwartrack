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
