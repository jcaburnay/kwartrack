import { describe, expect, it } from "vitest";
import { formatAccountLabel, type TransactionRow } from "../components/TransactionTable";

describe("formatAccountLabel", () => {
	const accounts = [
		{ id: 1n, name: "BDO" },
		{ id: 2n, name: "GCash" },
	];
	const partitions = [
		{ id: 10n, accountId: 1n, name: "__default__", isDefault: true },
		{ id: 11n, accountId: 1n, name: "Savings", isDefault: false },
		{ id: 20n, accountId: 2n, name: "__default__", isDefault: true },
	];

	it("expense: shows source account name", () => {
		const label = formatAccountLabel(
			{
				type: "expense",
				sourceSubAccountId: 10n,
				destinationSubAccountId: 0n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("BDO");
	});

	it("income: shows destination account name", () => {
		const label = formatAccountLabel(
			{
				type: "income",
				sourceSubAccountId: 0n,
				destinationSubAccountId: 20n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("GCash");
	});

	it("same-account transfer: shows account name", () => {
		const label = formatAccountLabel(
			{
				type: "transfer",
				sourceSubAccountId: 10n,
				destinationSubAccountId: 11n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("BDO");
	});

	it("cross-account transfer: shows Source → Dest", () => {
		const label = formatAccountLabel(
			{
				type: "transfer",
				sourceSubAccountId: 10n,
				destinationSubAccountId: 20n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("BDO → GCash");
	});
});
