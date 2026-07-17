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
	// Each debt row must be > 0 centavos (DB CHECK on debt.amount_centavos).
	// Catches explicit "0" inputs (Exact), rounding-to-zero in Percent/Shares,
	// and the all-zero fallback when computeShareCentavos returns null
	// (internally-inconsistent inputs, e.g. exact shares that don't sum).
	if (input.participants.some((p) => p.shareCentavos <= 0)) {
		return {
			ok: false,
			field: "participants",
			message:
				"Each participant must owe more than 0 — remove anyone with a 0 share or adjust the split",
		};
	}
	// The user-the-payer absorbs the remainder (spec §652) and is NOT a row in
	// `participants`. So shares only need to be <= total; the leftover becomes
	// the payer's share via split_event.user_share_centavos.
	const sum = input.participants.reduce((a, p) => a + p.shareCentavos, 0);
	if (sum > input.totalCentavos) {
		return { ok: false, field: "participants", message: "Shares exceed the total" };
	}
	return { ok: true };
}
