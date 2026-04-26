import type { SplitMethod } from "./splitMath";

export type SplitParticipantInput = {
	personId: string;
	shareCentavos: number;
	shareInputValue: number | null;
};

export type SplitInput = {
	description: string;
	totalCentavos: number;
	date: string;
	paidFromAccountId: string | null;
	tagId: string | null;
	method: SplitMethod;
	participants: SplitParticipantInput[];
};

export type SplitValidation = { ok: true } | { ok: false; field: string; message: string };

export function validateSplit(input: SplitInput): SplitValidation {
	if (input.description.trim().length === 0) {
		return { ok: false, field: "description", message: "Description is required" };
	}
	if (input.description.trim().length > 200) {
		return {
			ok: false,
			field: "description",
			message: "Description must be 200 characters or fewer",
		};
	}
	if (!Number.isInteger(input.totalCentavos) || input.totalCentavos <= 0) {
		return { ok: false, field: "totalCentavos", message: "Total must be greater than 0" };
	}
	if (!input.date) {
		return { ok: false, field: "date", message: "Date is required" };
	}
	if (!input.paidFromAccountId) {
		return { ok: false, field: "paidFromAccountId", message: "Paid-from account is required" };
	}
	if (!input.tagId) {
		return { ok: false, field: "tagId", message: "Tag is required" };
	}
	if (input.participants.length === 0) {
		return { ok: false, field: "participants", message: "Add at least one participant" };
	}
	const sum = input.participants.reduce((a, p) => a + p.shareCentavos, 0);
	if (sum !== input.totalCentavos) {
		return { ok: false, field: "participants", message: "Shares must sum to the total" };
	}
	return { ok: true };
}
