export type DebtDirection = "loaned" | "owed";

export type DebtInput = {
	personId: string | null;
	direction: DebtDirection;
	amountCentavos: number;
	date: string;
	description: string;
	paidAccountId: string | null;
	tagId: string | null;
};

export type DebtValidation = { ok: true } | { ok: false; field: string; message: string };

export function validateDebt(input: DebtInput): DebtValidation {
	if (!input.personId) {
		return { ok: false, field: "personId", message: "Counter-party is required" };
	}
	if (!Number.isInteger(input.amountCentavos) || input.amountCentavos <= 0) {
		return { ok: false, field: "amountCentavos", message: "Amount must be greater than 0" };
	}
	if (!input.date) {
		return { ok: false, field: "date", message: "Date is required" };
	}
	if (input.paidAccountId != null && !input.tagId) {
		return {
			ok: false,
			field: "tagId",
			message: "Tag is required when an account is selected",
		};
	}
	return { ok: true };
}
