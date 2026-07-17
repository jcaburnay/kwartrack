import { describe, expect, it } from "vitest";
import type { Account, AccountGroup } from "../utils/accountBalances";
import {
	computeNetWorth,
	creditUtilization,
	daysToMaturity,
	estimatedTimeDepositValue,
	groupRollup,
	interestAccrued,
	sortAccountsByGroupAndName,
} from "../utils/accountBalances";

const ts = "2026-04-24T00:00:00Z";

const base: Omit<
	Account,
	"id" | "name" | "type" | "balance_centavos" | "initial_balance_centavos"
> = {
	user_id: "u1",
	group_id: null,
	is_archived: false,
	credit_limit_centavos: null,
	principal_centavos: null,
	interest_rate_bps: null,
	maturity_date: null,
	interest_posting_interval: null,
	interest_recurring_id: null,
	is_matured: false,
	created_at: ts,
	updated_at: ts,
};

function mkAccount(p: Partial<Account> & Pick<Account, "name" | "type">): Account {
	return {
		id: p.name,
		initial_balance_centavos: p.balance_centavos ?? 0,
		balance_centavos: p.balance_centavos ?? 0,
		...base,
		...p,
	};
}

describe("computeNetWorth", () => {
	it("treats credit as liability and others as assets", () => {
		const accounts: Account[] = [
			mkAccount({ name: "Cash", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ name: "Savings", type: "savings", balance_centavos: 500_00 }),
			mkAccount({
				name: "Card",
				type: "credit",
				balance_centavos: 150_00,
				credit_limit_centavos: 1000_00,
			}),
		];
		expect(computeNetWorth(accounts)).toEqual({
			assetsCentavos: 600_00,
			liabilitiesCentavos: 150_00,
			netWorthCentavos: 450_00,
		});
	});

	it("excludes archived accounts", () => {
		const accounts: Account[] = [
			mkAccount({ name: "Cash", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ name: "OldCash", type: "cash", balance_centavos: 999_00, is_archived: true }),
		];
		expect(computeNetWorth(accounts).netWorthCentavos).toBe(100_00);
	});
});

describe("groupRollup", () => {
	it("sums net contribution per group, skipping archived", () => {
		const accounts: Account[] = [
			mkAccount({ name: "A", type: "cash", group_id: "g1", balance_centavos: 100 }),
			mkAccount({ name: "B", type: "savings", group_id: "g1", balance_centavos: 200 }),
			mkAccount({
				name: "C",
				type: "credit",
				group_id: "g1",
				balance_centavos: 80,
				credit_limit_centavos: 1000,
			}),
			mkAccount({
				name: "D",
				type: "cash",
				group_id: "g1",
				balance_centavos: 999,
				is_archived: true,
			}),
			mkAccount({ name: "E", type: "cash", group_id: "g2", balance_centavos: 50 }),
		];
		expect(groupRollup("g1", accounts)).toBe(100 + 200 - 80);
		expect(groupRollup("g2", accounts)).toBe(50);
	});
});

describe("creditUtilization", () => {
	it("returns null for non-credit accounts", () => {
		expect(creditUtilization(mkAccount({ name: "Cash", type: "cash" }))).toBeNull();
	});

	it("reports used / limit / pct for credit", () => {
		const card = mkAccount({
			name: "Card",
			type: "credit",
			balance_centavos: 250_00,
			credit_limit_centavos: 1000_00,
		});
		expect(creditUtilization(card)).toEqual({
			utilizedCentavos: 250_00,
			limitCentavos: 1000_00,
			utilizationPct: 0.25,
		});
	});
});

describe("time-deposit helpers", () => {
	const td = mkAccount({
		name: "TD",
		type: "time-deposit",
		balance_centavos: 100_000_00,
		initial_balance_centavos: 100_000_00,
		principal_centavos: 100_000_00,
		interest_rate_bps: 600,
		maturity_date: "2027-04-24",
	});

	it("interestAccrued is balance − principal", () => {
		const matured = mkAccount({
			name: "TD2",
			type: "time-deposit",
			balance_centavos: 100_500_00,
			initial_balance_centavos: 100_000_00,
			principal_centavos: 100_000_00,
			interest_rate_bps: 600,
			maturity_date: "2027-04-24",
		});
		expect(interestAccrued(matured)).toBe(500_00);
	});

	it("estimatedTimeDepositValue projects via simple interest", () => {
		const now = new Date("2026-04-24T00:00:00Z");
		// 1y at 6% → 106,000.00.
		const estimate = estimatedTimeDepositValue(td, now);
		expect(estimate).toBeGreaterThan(105_900_00);
		expect(estimate).toBeLessThan(106_100_00);
	});

	it("daysToMaturity is positive before maturity, ≤0 after", () => {
		const now = new Date("2026-04-24T00:00:00Z");
		expect(daysToMaturity(td, now)).toBeGreaterThan(300);
		const later = new Date("2028-04-24T00:00:00Z");
		expect(daysToMaturity(td, later)).toBeLessThan(0);
	});
});

describe("sortAccountsByGroupAndName", () => {
	it("places ungrouped first, then groups alphabetically, with name tie-break", () => {
		const groups: AccountGroup[] = [
			{ id: "g1", user_id: "u1", name: "Maya", created_at: ts, updated_at: ts },
			{ id: "g2", user_id: "u1", name: "BPI", created_at: ts, updated_at: ts },
		];
		const accounts: Account[] = [
			mkAccount({ name: "Maya Wallet", type: "e-wallet", group_id: "g1" }),
			mkAccount({ name: "BPI Savings", type: "savings", group_id: "g2" }),
			mkAccount({ name: "Pocket Cash", type: "cash", group_id: null }),
			mkAccount({ name: "Maya Goal", type: "savings", group_id: "g1" }),
		];
		const sorted = sortAccountsByGroupAndName(accounts, groups);
		expect(sorted.map((a) => a.name)).toEqual([
			"Pocket Cash", // ungrouped first
			"BPI Savings", // BPI group
			"Maya Goal", // Maya group, alpha
			"Maya Wallet",
		]);
	});
});
