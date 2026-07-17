import { describe, expect, it } from "vitest";
import { formatPhp, monthInTimezone, summarizeAccounts } from "./finance.js";
import type { Account } from "./types.js";

describe("finance helpers", () => {
	it("formats integer centavos as PHP", () => {
		expect(formatPhp(123_456)).toBe("₱1,234.56");
		expect(formatPhp(-50)).toBe("-₱0.50");
	});

	it("resolves the calendar month in the user's timezone", () => {
		const instant = new Date("2026-06-30T16:30:00Z");
		expect(monthInTimezone(instant, "Asia/Manila")).toBe("2026-07");
		expect(monthInTimezone(instant, "UTC")).toBe("2026-06");
	});

	it("keeps credit balances in liabilities and excludes archived accounts", () => {
		const base = {
			groupName: null,
			isArchived: false,
			creditLimitCentavos: null,
			maturityDate: null,
			isMatured: false,
		} as const;
		const accounts: Account[] = [
			{ ...base, id: "a", name: "Cash", type: "cash", balanceCentavos: 100_000 },
			{
				...base,
				id: "b",
				name: "Card",
				type: "credit",
				balanceCentavos: 30_000,
				creditLimitCentavos: 50_000,
			},
			{ ...base, id: "c", name: "Old", type: "savings", balanceCentavos: 99_999, isArchived: true },
		];
		expect(summarizeAccounts(accounts)).toEqual({
			assetsCentavos: 100_000,
			liabilitiesCentavos: 30_000,
			netWorthCentavos: 70_000,
		});
	});
});
