import type { Database } from "../types/supabase";
import type { Recurring } from "./recurringFilters";
import type { Transaction } from "./transactionFilters";

export type Account = Database["public"]["Tables"]["account"]["Row"];
export type AccountGroup = Database["public"]["Tables"]["account_group"]["Row"];
export type AccountType = Database["public"]["Enums"]["account_type"];

export const LIABILITY_TYPES: ReadonlySet<AccountType> = new Set(["credit"]);

export function isLiability(account: Pick<Account, "type">): boolean {
	return LIABILITY_TYPES.has(account.type);
}

export type NetWorth = {
	assetsCentavos: number;
	liabilitiesCentavos: number;
	netWorthCentavos: number;
};

export function computeNetWorth(accounts: readonly Account[]): NetWorth {
	let assets = 0;
	let liabilities = 0;
	for (const a of accounts) {
		if (a.is_archived) continue;
		if (isLiability(a)) liabilities += a.balance_centavos;
		else assets += a.balance_centavos;
	}
	return {
		assetsCentavos: assets,
		liabilitiesCentavos: liabilities,
		netWorthCentavos: assets - liabilities,
	};
}

/** Net rollup for a group (assets − liabilities). Skips archived members. */
export function groupRollup(groupId: string, accounts: readonly Account[]): number {
	let net = 0;
	for (const a of accounts) {
		if (a.group_id !== groupId || a.is_archived) continue;
		net += isLiability(a) ? -a.balance_centavos : a.balance_centavos;
	}
	return net;
}

export type CreditUtilization = {
	utilizedCentavos: number;
	limitCentavos: number;
	utilizationPct: number;
};

export function creditUtilization(account: Account): CreditUtilization | null {
	if (account.type !== "credit" || account.credit_limit_centavos == null) return null;
	const utilized = account.balance_centavos;
	const limit = account.credit_limit_centavos;
	return {
		utilizedCentavos: utilized,
		limitCentavos: limit,
		utilizationPct: limit === 0 ? 0 : utilized / limit,
	};
}

export type InstallmentMetrics = {
	committedCentavos: number;
	limitCentavos: number;
	availableCentavos: number;
	utilizationPct: number;
};

/**
 * Future installment commitments against a credit card's separate installment pool.
 * Sums `remaining_occurrences × amount_centavos` across recurrings whose
 * `from_account_id` is this card and that have a finite remaining count.
 * Open-ended recurrings (null `remaining_occurrences`) are treated as ongoing
 * subscriptions, not installment plans, so they are excluded.
 *
 * Returns null when the account has no separate installment limit; in that case
 * everything shares the regular pool and `creditUtilization` is enough.
 */
export function creditInstallmentMetrics(
	account: Account,
	recurrings: readonly Recurring[],
): InstallmentMetrics | null {
	if (account.type !== "credit" || account.installment_limit_centavos == null) return null;
	const limit = account.installment_limit_centavos;
	let committed = 0;
	for (const r of recurrings) {
		if (r.from_account_id !== account.id) continue;
		if (r.remaining_occurrences == null) continue;
		committed += r.remaining_occurrences * r.amount_centavos;
	}
	return {
		committedCentavos: committed,
		limitCentavos: limit,
		availableCentavos: Math.max(0, limit - committed),
		utilizationPct: limit === 0 ? 0 : committed / limit,
	};
}

/**
 * How much of a credit card's outstanding balance is attributable to posted
 * installment expenses, used by the `availableCredit` formula (spec §216) to
 * subtract installment-linked debt from the regular credit pool.
 *
 * Conservative-clamp attribution rule: `min(Σ installment-portion expenses,
 * balance)`. Spec doesn't define how to attribute payments to installment vs.
 * non-installment portions; clamping to balance avoids the pathological case
 * where past installments + payments make the sum exceed the current balance
 * (which would push availableCredit above creditLimit). In practice this
 * means payments drain the non-installment portion first — the user-favorable
 * read for "how much regular credit do I still have free?". If the user
 * prefers payments-drain-installments-first instead, this is a one-line
 * change.
 *
 * Returns 0 for non-credit accounts or when the input transactions list
 * doesn't contain any installment-portion expenses for this card.
 */
export function creditInstallmentLinkedBalance(
	account: Pick<Account, "id" | "type" | "balance_centavos">,
	transactions: readonly Pick<
		Transaction,
		"type" | "from_account_id" | "is_installment_portion" | "amount_centavos"
	>[],
): number {
	if (account.type !== "credit") return 0;
	let sum = 0;
	for (const t of transactions) {
		if (t.type !== "expense") continue;
		if (t.from_account_id !== account.id) continue;
		if (!t.is_installment_portion) continue;
		sum += t.amount_centavos;
	}
	return Math.min(sum, account.balance_centavos);
}

/**
 * Simple-interest projection for a time deposit.
 * `principal × (1 + rate × years)`. Displayed as an estimate only — real posting
 * cadence may fractionally differ.
 */
export function estimatedTimeDepositValue(
	account: Account,
	today: Date = new Date(),
): number | null {
	if (account.type !== "time-deposit") return null;
	if (
		account.principal_centavos == null ||
		account.interest_rate_bps == null ||
		account.maturity_date == null
	) {
		return null;
	}
	const maturity = new Date(`${account.maturity_date}T00:00:00Z`);
	const msInYear = 365.25 * 24 * 60 * 60 * 1000;
	const years = Math.max(0, (maturity.getTime() - today.getTime()) / msInYear);
	const annualRate = account.interest_rate_bps / 10000;
	return Math.round(account.principal_centavos * (1 + annualRate * years));
}

export function daysToMaturity(account: Account, today: Date = new Date()): number | null {
	if (account.type !== "time-deposit" || account.maturity_date == null) return null;
	const maturity = new Date(`${account.maturity_date}T00:00:00Z`);
	const msInDay = 24 * 60 * 60 * 1000;
	return Math.ceil((maturity.getTime() - today.getTime()) / msInDay);
}

export function interestAccrued(account: Account): number | null {
	if (account.type !== "time-deposit" || account.principal_centavos == null) return null;
	return account.balance_centavos - account.principal_centavos;
}

/**
 * Sort accounts per spec: ungrouped first, then each group alphabetically,
 * within each group alpha by name. Archival handling is up to the caller.
 */
export function sortAccountsByGroupAndName(
	accounts: readonly Account[],
	groups: readonly AccountGroup[],
): Account[] {
	const groupName = new Map(groups.map((g) => [g.id, g.name]));
	return [...accounts].sort((a, b) => {
		if (a.group_id == null && b.group_id != null) return -1;
		if (a.group_id != null && b.group_id == null) return 1;
		if (a.group_id !== b.group_id) {
			const ga = groupName.get(a.group_id ?? "") ?? "";
			const gb = groupName.get(b.group_id ?? "") ?? "";
			const cmp = ga.localeCompare(gb);
			if (cmp !== 0) return cmp;
		}
		return a.name.localeCompare(b.name);
	});
}
