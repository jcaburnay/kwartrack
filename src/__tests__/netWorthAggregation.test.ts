import { describe, expect, it } from "vitest";
import type { Account } from "../utils/accountBalances";
import {
	type AccountBalanceRow,
	type AssetMixSlice,
	accountsByBalance,
	assetMixByType,
	bucketCashFlowByMonth,
	bucketNetWorthByMonth,
	type CashFlowPoint,
	liabilitiesByType,
	mtdNetWorthDelta,
	type NetWorthPoint,
} from "../utils/netWorthAggregation";
import type { Transaction } from "../utils/transactionFilters";

const TZ = "Asia/Manila";

function mkAccount(overrides: Partial<Account> & Pick<Account, "type">): Account {
	return {
		id: overrides.id ?? "a1",
		user_id: "u1",
		name: overrides.name ?? "Account",
		type: overrides.type,
		group_id: overrides.group_id ?? null,
		initial_balance_centavos: overrides.initial_balance_centavos ?? 0,
		balance_centavos: overrides.balance_centavos ?? 0,
		is_archived: overrides.is_archived ?? false,
		credit_limit_centavos: overrides.credit_limit_centavos ?? null,
		installment_limit_centavos: overrides.installment_limit_centavos ?? null,
		principal_centavos: overrides.principal_centavos ?? null,
		interest_rate_bps: overrides.interest_rate_bps ?? null,
		maturity_date: overrides.maturity_date ?? null,
		interest_posting_interval: overrides.interest_posting_interval ?? null,
		interest_recurring_id: overrides.interest_recurring_id ?? null,
		is_matured: overrides.is_matured ?? false,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	};
}

function mkTx(
	overrides: Partial<Transaction> & Pick<Transaction, "type" | "amount_centavos" | "date">,
): Transaction {
	return {
		id: overrides.id ?? "t1",
		user_id: "u1",
		amount_centavos: overrides.amount_centavos,
		type: overrides.type,
		tag_id: overrides.tag_id ?? null,
		from_account_id: overrides.from_account_id ?? null,
		to_account_id: overrides.to_account_id ?? null,
		fee_centavos: overrides.fee_centavos ?? null,
		description: overrides.description ?? null,
		date: overrides.date,
		parent_transaction_id: overrides.parent_transaction_id ?? null,
		recurring_id: overrides.recurring_id ?? null,
		split_id: overrides.split_id ?? null,
		debt_id: overrides.debt_id ?? null,
		is_installment_portion: overrides.is_installment_portion ?? false,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	};
}

describe("assetMixByType", () => {
	it("returns empty array when no accounts", () => {
		expect(assetMixByType([])).toEqual<AssetMixSlice[]>([]);
	});

	it("groups assets by type and sorts by total descending", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 5_00 }),
			mkAccount({ id: "a2", type: "savings", balance_centavos: 100_00 }),
			mkAccount({ id: "a3", type: "cash", balance_centavos: 10_00 }),
		];
		const result = assetMixByType(accounts);
		expect(result).toEqual<AssetMixSlice[]>([
			{ type: "savings", label: "Savings", centavos: 100_00 },
			{ type: "cash", label: "Cash", centavos: 15_00 },
		]);
	});

	it("excludes archived accounts", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "cash", balance_centavos: 50_00, is_archived: true }),
		];
		expect(assetMixByType(accounts)).toEqual<AssetMixSlice[]>([
			{ type: "cash", label: "Cash", centavos: 100_00 },
		]);
	});

	it("excludes liability (credit) accounts", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "credit", balance_centavos: 50_00 }),
		];
		expect(assetMixByType(accounts)).toEqual<AssetMixSlice[]>([
			{ type: "cash", label: "Cash", centavos: 100_00 },
		]);
	});
});

describe("liabilitiesByType", () => {
	it("returns only liability accounts grouped by type", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "credit", balance_centavos: 50_00 }),
			mkAccount({ id: "a3", type: "credit", balance_centavos: 25_00 }),
		];
		expect(liabilitiesByType(accounts)).toEqual<AssetMixSlice[]>([
			{ type: "credit", label: "Credit card", centavos: 75_00 },
		]);
	});

	it("excludes archived liability accounts", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "credit", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "credit", balance_centavos: 50_00, is_archived: true }),
		];
		expect(liabilitiesByType(accounts)).toEqual<AssetMixSlice[]>([
			{ type: "credit", label: "Credit card", centavos: 100_00 },
		]);
	});

	it("returns empty array when no liabilities", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 })];
		expect(liabilitiesByType(accounts)).toEqual<AssetMixSlice[]>([]);
	});
});

describe("accountsByBalance", () => {
	it("sorts non-archived accounts by balance descending and flags liabilities", () => {
		const accounts = [
			mkAccount({ id: "a1", name: "Cash", type: "cash", balance_centavos: 5_00 }),
			mkAccount({ id: "a2", name: "BPI", type: "savings", balance_centavos: 100_00 }),
			mkAccount({ id: "a3", name: "Card", type: "credit", balance_centavos: 50_00 }),
		];
		const result = accountsByBalance(accounts);
		expect(result).toEqual<AccountBalanceRow[]>([
			{ accountId: "a2", name: "BPI", centavos: 100_00, isLiability: false },
			{ accountId: "a3", name: "Card", centavos: 50_00, isLiability: true },
			{ accountId: "a1", name: "Cash", centavos: 5_00, isLiability: false },
		]);
	});

	it("excludes archived accounts", () => {
		const accounts = [
			mkAccount({ id: "a1", name: "Cash", type: "cash", balance_centavos: 100_00 }),
			mkAccount({
				id: "a2",
				name: "Old",
				type: "savings",
				balance_centavos: 50_00,
				is_archived: true,
			}),
		];
		expect(accountsByBalance(accounts).map((r) => r.accountId)).toEqual(["a1"]);
	});

	it("returns empty when no accounts", () => {
		expect(accountsByBalance([])).toEqual<AccountBalanceRow[]>([]);
	});
});

describe("bucketCashFlowByMonth", () => {
	const TODAY = new Date("2026-04-15T08:00:00Z");

	it("returns the requested number of buckets, oldest → newest, anchored on today", () => {
		const result = bucketCashFlowByMonth([], TODAY, TZ, 12);
		expect(result).toHaveLength(12);
		expect(result[0].monthISO).toBe("2025-05");
		expect(result[11].monthISO).toBe("2026-04");
		expect(result.every((r) => r.incomeCentavos === 0 && r.expenseCentavos === 0)).toBe(true);
	});

	it("supports a 3-month range", () => {
		const result = bucketCashFlowByMonth([], TODAY, TZ, 3);
		expect(result).toHaveLength(3);
		expect(result[0].monthISO).toBe("2026-02");
		expect(result[2].monthISO).toBe("2026-04");
	});

	it("buckets income and expense separately and computes net", () => {
		const txs = [
			mkTx({ id: "t1", type: "income", date: "2026-04-01", amount_centavos: 5_000_00 }),
			mkTx({ id: "t2", type: "expense", date: "2026-04-10", amount_centavos: 1_000_00 }),
			mkTx({ id: "t3", type: "expense", date: "2026-04-20", amount_centavos: 500_00 }),
			mkTx({ id: "t4", type: "income", date: "2026-03-15", amount_centavos: 3_000_00 }),
		];
		const result = bucketCashFlowByMonth(txs, TODAY, TZ, 12);
		const apr = result.find((r) => r.monthISO === "2026-04");
		const mar = result.find((r) => r.monthISO === "2026-03");
		expect(apr).toEqual<CashFlowPoint>({
			monthISO: "2026-04",
			monthLabel: "April 2026",
			incomeCentavos: 5_000_00,
			expenseCentavos: 1_500_00,
			netCentavos: 3_500_00,
		});
		expect(mar?.incomeCentavos).toBe(3_000_00);
		expect(mar?.expenseCentavos).toBe(0);
		expect(mar?.netCentavos).toBe(3_000_00);
	});

	it("ignores transfer-type rows (neutral cash flow)", () => {
		const txs = [
			mkTx({ id: "t1", type: "transfer", date: "2026-04-10", amount_centavos: 10_000_00 }),
			mkTx({ id: "t2", type: "income", date: "2026-04-10", amount_centavos: 100_00 }),
		];
		const result = bucketCashFlowByMonth(txs, TODAY, TZ, 12);
		const apr = result.find((r) => r.monthISO === "2026-04");
		expect(apr?.incomeCentavos).toBe(100_00);
		expect(apr?.expenseCentavos).toBe(0);
	});

	it("ignores rows outside the window", () => {
		const txs = [
			mkTx({ id: "t1", type: "income", date: "2025-01-01", amount_centavos: 9_999_00 }),
			mkTx({ id: "t2", type: "expense", date: "2026-04-15", amount_centavos: 1_00 }),
		];
		const result = bucketCashFlowByMonth(txs, TODAY, TZ, 12);
		const totalIncome = result.reduce((acc, r) => acc + r.incomeCentavos, 0);
		const totalExpense = result.reduce((acc, r) => acc + r.expenseCentavos, 0);
		expect(totalIncome).toBe(0);
		expect(totalExpense).toBe(1_00);
	});
});

describe("bucketNetWorthByMonth", () => {
	const TODAY = new Date("2026-04-15T08:00:00Z");

	it("returns flat line at current net worth when there are no transactions", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "savings", balance_centavos: 500_00 }),
		];
		const result = bucketNetWorthByMonth(accounts, [], TODAY, TZ, 12);
		expect(result).toHaveLength(12);
		expect(result.every((r) => r.netWorthCentavos === 600_00)).toBe(true);
		expect(result[0].monthISO).toBe("2025-05");
		expect(result[11].monthISO).toBe("2026-04");
	});

	it("supports a 3-month range", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 })];
		const result = bucketNetWorthByMonth(accounts, [], TODAY, TZ, 3);
		expect(result).toHaveLength(3);
	});

	it("steps up between months when income lands in current month", () => {
		// Today is 2026-04-15. Cash account holds 600 currently.
		// One income tx of +500 on 2026-04-10. Reversing it for any month-end
		// before April should give: 600 - 500 = 100 for March-end and earlier.
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 600_00 })];
		const txs = [
			mkTx({
				id: "t1",
				type: "income",
				date: "2026-04-10",
				amount_centavos: 500_00,
				to_account_id: "a1",
			}),
		];
		const result = bucketNetWorthByMonth(accounts, txs, TODAY, TZ, 12);
		const apr = result.find((r) => r.monthISO === "2026-04");
		const mar = result.find((r) => r.monthISO === "2026-03");
		expect(apr?.netWorthCentavos).toBe(600_00);
		expect(mar?.netWorthCentavos).toBe(100_00);
	});

	it("steps down between months when expense lands in current month", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 })];
		const txs = [
			mkTx({
				id: "t1",
				type: "expense",
				date: "2026-04-05",
				amount_centavos: 200_00,
				from_account_id: "a1",
			}),
		];
		const result = bucketNetWorthByMonth(accounts, txs, TODAY, TZ, 12);
		const apr = result.find((r) => r.monthISO === "2026-04");
		const mar = result.find((r) => r.monthISO === "2026-03");
		expect(apr?.netWorthCentavos).toBe(100_00);
		expect(mar?.netWorthCentavos).toBe(300_00);
	});

	it("sign-flips for credit (liability) accounts", () => {
		// Credit balance grows when you spend on it, so a 200 expense raises
		// the balance from 0 → 200. Reversing the expense reduces balance to 0
		// for any month-end before April. Net worth = assets - liabilities.
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 1_000_00 }),
			mkAccount({ id: "a2", type: "credit", balance_centavos: 200_00 }),
		];
		const txs = [
			mkTx({
				id: "t1",
				type: "expense",
				date: "2026-04-10",
				amount_centavos: 200_00,
				from_account_id: "a2",
			}),
		];
		const result = bucketNetWorthByMonth(accounts, txs, TODAY, TZ, 12);
		const apr = result.find((r) => r.monthISO === "2026-04");
		const mar = result.find((r) => r.monthISO === "2026-03");
		// April: 1_000 cash - 200 credit = 800
		expect(apr?.netWorthCentavos).toBe(800_00);
		// March: cash unchanged (transaction was on credit), credit was 0 (the
		// 200 expense on April 10 hadn't happened) → 1_000 - 0 = 1_000
		expect(mar?.netWorthCentavos).toBe(1_000_00);
	});

	it("excludes archived accounts from the running totals", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "cash", balance_centavos: 5_000_00, is_archived: true }),
		];
		const result = bucketNetWorthByMonth(accounts, [], TODAY, TZ, 12);
		expect(result.every((r) => r.netWorthCentavos === 100_00)).toBe(true);
	});

	it("handles transfers as net-zero movement between two non-archived accounts", () => {
		const accounts = [
			mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 }),
			mkAccount({ id: "a2", type: "savings", balance_centavos: 500_00 }),
		];
		const txs = [
			mkTx({
				id: "t1",
				type: "transfer",
				date: "2026-04-10",
				amount_centavos: 200_00,
				from_account_id: "a1",
				to_account_id: "a2",
			}),
		];
		const result = bucketNetWorthByMonth(accounts, txs, TODAY, TZ, 12);
		// Net worth shouldn't change at all because money just moved.
		expect(result.every((r) => r.netWorthCentavos === 600_00)).toBe(true);
	});

	it("returns NetWorthPoint with monthLabel populated", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 100_00 })];
		const result = bucketNetWorthByMonth(accounts, [], TODAY, TZ, 12);
		expect(result[11]).toEqual<NetWorthPoint>({
			monthISO: "2026-04",
			monthLabel: "April 2026",
			netWorthCentavos: 100_00,
		});
	});
});

describe("mtdNetWorthDelta", () => {
	const TODAY = new Date("2026-04-15T08:00:00Z");

	it("is zero when no transactions in current month", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 1_000_00 })];
		const lastMonthTx = [
			mkTx({
				id: "t1",
				type: "income",
				date: "2026-03-30",
				amount_centavos: 5_000_00,
				to_account_id: "a1",
			}),
		];
		expect(mtdNetWorthDelta(accounts, lastMonthTx, TODAY, TZ).deltaCentavos).toBe(0);
	});

	it("equals the current-month income for a fresh income tx", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 1_500_00 })];
		const txs = [
			mkTx({
				id: "t1",
				type: "income",
				date: "2026-04-10",
				amount_centavos: 500_00,
				to_account_id: "a1",
			}),
		];
		expect(mtdNetWorthDelta(accounts, txs, TODAY, TZ).deltaCentavos).toBe(500_00);
	});

	it("subtracts current-month expense", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 700_00 })];
		const txs = [
			mkTx({
				id: "t1",
				type: "expense",
				date: "2026-04-05",
				amount_centavos: 300_00,
				from_account_id: "a1",
			}),
		];
		expect(mtdNetWorthDelta(accounts, txs, TODAY, TZ).deltaCentavos).toBe(-300_00);
	});

	it("nets income against expense in the current month", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 1_200_00 })];
		const txs = [
			mkTx({
				id: "t1",
				type: "income",
				date: "2026-04-01",
				amount_centavos: 500_00,
				to_account_id: "a1",
			}),
			mkTx({
				id: "t2",
				type: "expense",
				date: "2026-04-10",
				amount_centavos: 300_00,
				from_account_id: "a1",
			}),
		];
		expect(mtdNetWorthDelta(accounts, txs, TODAY, TZ).deltaCentavos).toBe(200_00);
	});

	it("reports percentOfCurrent vs current net worth", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 100_000_00 })];
		const txs = [
			mkTx({
				id: "t1",
				type: "income",
				date: "2026-04-10",
				amount_centavos: 5_000_00,
				to_account_id: "a1",
			}),
		];
		const result = mtdNetWorthDelta(accounts, txs, TODAY, TZ);
		expect(result.percentOfCurrent).toBeCloseTo(0.05, 5);
	});

	it("guards against divide-by-zero when current net worth is 0", () => {
		const accounts = [mkAccount({ id: "a1", type: "cash", balance_centavos: 0 })];
		const result = mtdNetWorthDelta(accounts, [], TODAY, TZ);
		expect(result.percentOfCurrent).toBe(0);
	});
});
