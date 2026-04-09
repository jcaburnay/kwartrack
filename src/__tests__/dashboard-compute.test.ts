import { describe, expect, it } from "vitest";
import {
	computeAccountSummaries,
	computeMonthlyTrend,
	computeSpendingByTag,
	computeTotalBalance,
} from "../utils/dashboardCompute";

// Helper: build a microseconds-since-unix-epoch BigInt from a Date
function toMicros(d: Date): bigint {
	return BigInt(d.getTime()) * 1000n;
}

// Shared test data for balance/account tests
const accounts = [
	{ id: 1n, name: "BDO", iconBankId: "bdo" },
	{ id: 2n, name: "GCash", iconBankId: "gcash" },
	{ id: 3n, name: "BPI Credit", iconBankId: undefined },
];

const partitions = [
	{
		id: 10n,
		accountId: 1n,
		name: "__default__",
		balanceCentavos: 5000000n,
		isDefault: true,
		partitionType: "wallet",
		creditLimitCentavos: 0n,
	},
	{
		id: 11n,
		accountId: 1n,
		name: "Savings",
		balanceCentavos: 3520000n,
		isDefault: false,
		partitionType: "wallet",
		creditLimitCentavos: 0n,
	},
	{
		id: 20n,
		accountId: 2n,
		name: "__default__",
		balanceCentavos: 1273050n,
		isDefault: true,
		partitionType: "wallet",
		creditLimitCentavos: 0n,
	},
	{
		id: 30n,
		accountId: 3n,
		name: "__default__",
		balanceCentavos: -750000n,
		isDefault: true,
		partitionType: "credit",
		creditLimitCentavos: 5000000n,
	},
];

// Dates for spending/trend tests
const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

describe("dashboardCompute", () => {
	describe("computeTotalBalance", () => {
		it("sums all partition balances including negative for credit", () => {
			const total = computeTotalBalance(partitions);
			// 5000000 + 3520000 + 1273050 + (-750000) = 9043050
			expect(total).toBe(9043050n);
		});

		it("returns 0n for empty array", () => {
			expect(computeTotalBalance([])).toBe(0n);
		});
	});

	describe("computeAccountSummaries", () => {
		it("computes balance per account and derives type correctly", () => {
			const result = computeAccountSummaries(accounts, partitions);

			// Sorted by name: BDO, BPI Credit, GCash
			expect(result).toHaveLength(3);

			expect(result[0].name).toBe("BDO");
			expect(result[0].balanceCentavos).toBe(8520000n); // 5000000 + 3520000
			expect(result[0].type).toBe("Savings");

			expect(result[1].name).toBe("BPI Credit");
			expect(result[1].balanceCentavos).toBe(-750000n);
			expect(result[1].type).toBe("Credit Card");

			expect(result[2].name).toBe("GCash");
			expect(result[2].balanceCentavos).toBe(1273050n);
			expect(result[2].type).toBe("Savings");
		});

		it("returns empty array for no accounts", () => {
			expect(computeAccountSummaries([], partitions)).toEqual([]);
		});

		it("sorts by name", () => {
			const result = computeAccountSummaries(accounts, partitions);
			const names = result.map((s) => s.name);
			expect(names).toEqual(["BDO", "BPI Credit", "GCash"]);
		});
	});

	describe("computeSpendingByTag", () => {
		it("groups current month expenses by tag, sorted descending", () => {
			const transactions = [
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 150000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "expense",
					tag: "transport",
					amountCentavos: 50000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 80000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
			];

			const result = computeSpendingByTag(transactions);
			expect(result).toEqual([
				{ tag: "grocery", amountCentavos: 230000n },
				{ tag: "transport", amountCentavos: 50000n },
			]);
		});

		it("excludes income and non-current-month transactions", () => {
			const transactions = [
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 50000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "income",
					tag: "salary",
					amountCentavos: 5000000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 30000n,
					date: { microsSinceUnixEpoch: toMicros(lastMonth) },
				},
			];

			const result = computeSpendingByTag(transactions);
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({ tag: "grocery", amountCentavos: 50000n });
		});

		it("returns empty array when no expenses", () => {
			const transactions = [
				{
					type: "income",
					tag: "salary",
					amountCentavos: 5000000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
			];
			expect(computeSpendingByTag(transactions)).toEqual([]);
		});
	});

	describe("computeMonthlyTrend", () => {
		it("aggregates income and expenses by month for last 6 months", () => {
			const transactions = [
				{
					type: "income",
					tag: "salary",
					amountCentavos: 5000000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 150000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "expense",
					tag: "transport",
					amountCentavos: 50000n,
					date: { microsSinceUnixEpoch: toMicros(lastMonth) },
				},
				{
					type: "income",
					tag: "salary",
					amountCentavos: 4500000n,
					date: { microsSinceUnixEpoch: toMicros(lastMonth) },
				},
			];

			const result = computeMonthlyTrend(transactions);
			expect(result).toHaveLength(6);

			// Last entry is current month
			const current = result[result.length - 1];
			expect(current.incomeCentavos).toBe(5000000n);
			expect(current.expensesCentavos).toBe(150000n);

			// Second to last is last month
			const prev = result[result.length - 2];
			expect(prev.incomeCentavos).toBe(4500000n);
			expect(prev.expensesCentavos).toBe(50000n);
		});

		it("returns months with 0n for months with no transactions", () => {
			const result = computeMonthlyTrend([]);
			expect(result).toHaveLength(6);
			for (const point of result) {
				expect(point.incomeCentavos).toBe(0n);
				expect(point.expensesCentavos).toBe(0n);
			}
		});

		it("each point has month key (YYYY-MM) and short label (3 chars)", () => {
			const result = computeMonthlyTrend([]);
			for (const point of result) {
				expect(point.month).toMatch(/^\d{4}-\d{2}$/);
				expect(point.label).toHaveLength(3);
			}

			// Verify current month key
			const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
			expect(result[result.length - 1].month).toBe(currentKey);
		});
	});
});
