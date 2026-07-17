/**
 * Pure validation for the New/Edit Recurring forms. Reuses
 * `validateTransaction`'s cross-field rules and adds recurring-specific
 * checks (service name, interval, schedule anchor, remaining-occurrences).
 */
import type { Database } from "../types/supabase";
import { type TransactionInput, validateTransaction } from "./transactionValidation";

export type RecurringInterval = Database["public"]["Enums"]["recurring_interval"];

export type RecurringInput = TransactionInput & {
	service: string;
	interval: RecurringInterval;
	firstOccurrenceDate: string;
	remainingOccurrences: number | null;
};

export type ValidationResult = { ok: true } | { ok: false; field: string; message: string };

export function validateRecurring(input: RecurringInput): ValidationResult {
	if (!input.service || input.service.trim().length === 0) {
		return { ok: false, field: "service", message: "Service name is required" };
	}
	if (input.service.trim().length > 80) {
		return { ok: false, field: "service", message: "Service name must be 80 characters or fewer" };
	}
	if (!input.firstOccurrenceDate) {
		return {
			ok: false,
			field: "firstOccurrenceDate",
			message: "Schedule (first occurrence) is required",
		};
	}
	if (input.remainingOccurrences != null) {
		if (!Number.isInteger(input.remainingOccurrences) || input.remainingOccurrences <= 0) {
			return {
				ok: false,
				field: "remainingOccurrences",
				message: "Remaining occurrences must be a positive integer",
			};
		}
	}
	return validateTransaction({ ...input, date: input.firstOccurrenceDate });
}
