/**
 * Pure validation for the New/Edit Transaction forms. Mirrors the DB's
 * `tx_type_fields` CHECK so the client fails fast with a friendly message
 * instead of trusting the DB to surface a constraint violation.
 */
import type { Database } from "../types/supabase";

export type TransactionType = Database["public"]["Enums"]["transaction_type"];

export type TransactionInput = {
	type: TransactionType;
	amountCentavos: number;
	tagId: string | null;
	fromAccountId: string | null;
	toAccountId: string | null;
	feeCentavos: number | null;
	description: string;
	date: string;
};

export type ValidationResult = { ok: true } | { ok: false; field: string; message: string };

const ok = (): ValidationResult => ({ ok: true });
const fail = (field: string, message: string): ValidationResult => ({
	ok: false,
	field,
	message,
});

export function validateTransaction(input: TransactionInput): ValidationResult {
	if (!Number.isFinite(input.amountCentavos) || input.amountCentavos <= 0) {
		return fail("amount", "Amount must be greater than 0");
	}
	if (!input.date) return fail("date", "Date is required");

	if (input.type === "expense") {
		if (!input.fromAccountId) return fail("fromAccountId", "Source account is required");
		if (input.toAccountId) return fail("toAccountId", "Destination is not allowed on an expense");
		if (!input.tagId) return fail("tagId", "Tag is required for expenses");
		if (input.feeCentavos != null) return fail("fee", "Fees only apply to transfers");
		return ok();
	}

	if (input.type === "income") {
		if (!input.toAccountId) return fail("toAccountId", "Destination account is required");
		if (input.fromAccountId) return fail("fromAccountId", "Source is not allowed on income");
		if (!input.tagId) return fail("tagId", "Tag is required for income");
		if (input.feeCentavos != null) return fail("fee", "Fees only apply to transfers");
		return ok();
	}

	// transfer
	if (!input.fromAccountId) return fail("fromAccountId", "Source account is required");
	if (!input.toAccountId) return fail("toAccountId", "Destination account is required");
	if (input.fromAccountId === input.toAccountId) {
		return fail("toAccountId", "Source and destination must differ");
	}
	if (input.feeCentavos != null) {
		if (!Number.isFinite(input.feeCentavos) || input.feeCentavos <= 0) {
			return fail("fee", "Fee must be greater than 0 when provided");
		}
	}
	return ok();
}
