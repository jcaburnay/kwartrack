import { describe, expect, it } from "vitest";

describe("TransactionsPage: account partition filter logic", () => {
	const partitions = [
		{ id: 10n, accountId: 1n, name: "__default__", isDefault: true },
		{ id: 11n, accountId: 1n, name: "Savings", isDefault: false },
		{ id: 20n, accountId: 2n, name: "__default__", isDefault: true },
	];

	const transactions = [
		{
			id: 1n,
			type: "expense",
			sourcePartitionId: 10n,
			destinationPartitionId: 0n,
			tag: "foods",
			amountCentavos: 500n,
			serviceFeeCentavos: 0n,
			description: "",
			date: { microsSinceUnixEpoch: 1000000n },
		},
		{
			id: 2n,
			type: "income",
			sourcePartitionId: 0n,
			destinationPartitionId: 20n,
			tag: "monthly-salary",
			amountCentavos: 100000n,
			serviceFeeCentavos: 0n,
			description: "Salary",
			date: { microsSinceUnixEpoch: 2000000n },
		},
		{
			id: 3n,
			type: "transfer",
			sourcePartitionId: 10n,
			destinationPartitionId: 20n,
			tag: "",
			amountCentavos: 5000n,
			serviceFeeCentavos: 50n,
			description: "Transfer",
			date: { microsSinceUnixEpoch: 3000000n },
		},
	];

	function filterByAccountPartition(
		txns: typeof transactions,
		parts: typeof partitions,
		accountPartition: string | undefined,
	) {
		if (!accountPartition) return txns;

		if (accountPartition.startsWith("account:")) {
			const accountId = BigInt(accountPartition.split(":")[1]);
			const partIds = parts.filter((p) => p.accountId === accountId).map((p) => p.id);
			return txns.filter(
				(t) => partIds.includes(t.sourcePartitionId) || partIds.includes(t.destinationPartitionId),
			);
		}

		if (accountPartition.startsWith("partition:")) {
			const partId = BigInt(accountPartition.split(":")[1]);
			return txns.filter(
				(t) => t.sourcePartitionId === partId || t.destinationPartitionId === partId,
			);
		}

		return txns;
	}

	it("no filter returns all transactions", () => {
		expect(filterByAccountPartition(transactions, partitions, undefined)).toHaveLength(3);
		expect(filterByAccountPartition(transactions, partitions, "")).toHaveLength(3);
	});

	it("filter by account:1 returns transactions involving account 1 partitions", () => {
		const result = filterByAccountPartition(transactions, partitions, "account:1");
		expect(result).toHaveLength(2);
		expect(result.map((t) => t.id)).toEqual([1n, 3n]);
	});

	it("filter by account:2 returns transactions involving account 2 partitions", () => {
		const result = filterByAccountPartition(transactions, partitions, "account:2");
		expect(result).toHaveLength(2);
		expect(result.map((t) => t.id)).toEqual([2n, 3n]);
	});

	it("filter by partition:10 returns transactions involving that partition", () => {
		const result = filterByAccountPartition(transactions, partitions, "partition:10");
		expect(result).toHaveLength(2);
		expect(result.map((t) => t.id)).toEqual([1n, 3n]);
	});

	it("filter by partition:20 returns transactions involving that partition", () => {
		const result = filterByAccountPartition(transactions, partitions, "partition:20");
		expect(result).toHaveLength(2);
		expect(result.map((t) => t.id)).toEqual([2n, 3n]);
	});

	it("filter by partition:11 returns no transactions", () => {
		const result = filterByAccountPartition(transactions, partitions, "partition:11");
		expect(result).toHaveLength(0);
	});
});
