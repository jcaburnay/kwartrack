/**
 * Per-type account form validators. Plain functions; the forms themselves
 * handle presentation (via RHF's `validate`), keeping this testable in Vitest.
 */
import type { AccountType } from "./accountBalances";

export type CommonAccountInput = {
	name: string;
	initialBalanceCentavos: number;
};

export type CreditInput = CommonAccountInput & {
	creditLimitCentavos: number;
	installmentLimitCentavos: number | null;
};

export type TimeDepositInput = {
	name: string;
	principalCentavos: number;
	interestRateBps: number;
	maturityDate: string;
	interestPostingInterval: "monthly" | "quarterly" | "semi-annual" | "annual" | "at-maturity";
};

export type ValidationResult = { ok: true } | { ok: false; field: string; message: string };

const ok = (): ValidationResult => ({ ok: true });
const fail = (field: string, message: string): ValidationResult => ({
	ok: false,
	field,
	message,
});

export function validateName(name: string): ValidationResult {
	const trimmed = name.trim();
	if (trimmed.length < 1) return fail("name", "Name is required");
	if (trimmed.length > 50) return fail("name", "Name must be 50 characters or fewer");
	return ok();
}

export function validateCommon(input: CommonAccountInput): ValidationResult {
	const n = validateName(input.name);
	if (!n.ok) return n;
	if (!Number.isFinite(input.initialBalanceCentavos) || input.initialBalanceCentavos < 0) {
		return fail("initialBalance", "Initial balance must be 0 or more");
	}
	return ok();
}

export function validateCredit(input: CreditInput): ValidationResult {
	const base = validateCommon(input);
	if (!base.ok) return base;
	if (!Number.isFinite(input.creditLimitCentavos) || input.creditLimitCentavos <= 0) {
		return fail("creditLimit", "Credit limit must be greater than 0");
	}
	if (input.initialBalanceCentavos > input.creditLimitCentavos) {
		return fail("initialBalance", "Initial balance can't exceed credit limit");
	}
	if (input.installmentLimitCentavos != null) {
		if (!Number.isFinite(input.installmentLimitCentavos) || input.installmentLimitCentavos < 0) {
			return fail("installmentLimit", "Installment limit must be 0 or more");
		}
	}
	return ok();
}

export function validateTimeDeposit(
	input: TimeDepositInput,
	today: Date = new Date(),
): ValidationResult {
	const n = validateName(input.name);
	if (!n.ok) return n;
	if (!Number.isFinite(input.principalCentavos) || input.principalCentavos <= 0) {
		return fail("principal", "Principal must be greater than 0");
	}
	if (!Number.isFinite(input.interestRateBps) || input.interestRateBps <= 0) {
		return fail("interestRate", "Interest rate must be greater than 0");
	}
	if (!input.maturityDate) return fail("maturityDate", "Maturity date is required");
	const maturity = new Date(`${input.maturityDate}T00:00:00`);
	if (Number.isNaN(maturity.getTime())) {
		return fail("maturityDate", "Invalid maturity date");
	}
	if (maturity.getTime() <= today.getTime()) {
		return fail("maturityDate", "Maturity date must be in the future");
	}
	return ok();
}

export const ACCOUNT_TYPES: readonly AccountType[] = [
	"cash",
	"e-wallet",
	"savings",
	"credit",
	"time-deposit",
] as const;

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
	cash: "Cash",
	"e-wallet": "E-Wallet",
	savings: "Savings",
	credit: "Credit card",
	"time-deposit": "Time deposit",
};
