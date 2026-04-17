import { describe, expect, it } from "vitest";
import { computeTagStatuses, getCurrentMonthExpenses } from "../utils/budgetCompute";

function toMicros(d: Date): bigint {
	return BigInt(d.getTime()) * 1000n;
}

const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

describe("getCurrentMonthExpenses", () => {
	it("filters to current calendar month only", () => {
		const transactions = [
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 50000n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 30000n,
				date: { microsSinceUnixEpoch: toMicros(lastMonth) },
			},
		];
		const result = getCurrentMonthExpenses(transactions);
		expect(result.get("grocery")).toBe(50000n);
		expect(result.size).toBe(1);
	});

	it("ignores income and transfer transactions", () => {
		const transactions = [
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 50000n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
			{
				type: "income",
				tag: "grocery",
				amountCentavos: 100000n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
			{
				type: "transfer",
				tag: "grocery",
				amountCentavos: 20000n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
		];
		const result = getCurrentMonthExpenses(transactions);
		expect(result.get("grocery")).toBe(50000n);
		expect(result.size).toBe(1);
	});
});

describe("computeTagStatuses", () => {
	it("normal case: 84% used", () => {
		const allocations = [{ tag: "grocery", allocatedCentavos: 500000n }];
		const spentByTag = new Map<string, bigint>([["grocery", 420000n]]);
		const result = computeTagStatuses(allocations, spentByTag);
		expect(result[0].percentUsed).toBe(84);
		expect(result[0].remainingCentavos).toBe(80000n);
		expect(result[0].spentCentavos).toBe(420000n);
		expect(result[0].hasAllocation).toBe(true);
	});

	it("at budget: 100% used, 0n remaining", () => {
		const allocations = [{ tag: "bills", allocatedCentavos: 300000n }];
		const spentByTag = new Map<string, bigint>([["bills", 300000n]]);
		const result = computeTagStatuses(allocations, spentByTag);
		expect(result[0].percentUsed).toBe(100);
		expect(result[0].remainingCentavos).toBe(0n);
	});

	it("unspent tag: 0 spent, 0%, full remaining", () => {
		const allocations = [{ tag: "travel", allocatedCentavos: 100000n }];
		const spentByTag = new Map<string, bigint>();
		const result = computeTagStatuses(allocations, spentByTag);
		expect(result[0].spentCentavos).toBe(0n);
		expect(result[0].percentUsed).toBe(0);
		expect(result[0].remainingCentavos).toBe(100000n);
	});
});
