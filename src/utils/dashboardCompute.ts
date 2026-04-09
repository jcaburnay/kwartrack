/**
 * Dashboard computation utility — pure functions for DashboardPage.
 * No side effects, no SpacetimeDB imports.
 * All monetary values are BigInt centavos (i64 from SpacetimeDB).
 */

interface PartitionRow {
	id: bigint;
	accountId: bigint;
	name: string;
	balanceCentavos: bigint;
	isDefault: boolean;
	partitionType: string;
	creditLimitCentavos: bigint;
}

interface AccountRow {
	id: bigint;
	name: string;
}

interface TransactionRow {
	type: string;
	tag: string;
	amountCentavos: bigint;
	date: { microsSinceUnixEpoch: bigint };
}

export interface AccountSummary {
	id: bigint;
	name: string;
	type: string;
	balanceCentavos: bigint;
	iconBankId: string | undefined;
}

export interface SpendingByTag {
	tag: string;
	amountCentavos: bigint;
}

export interface MonthlyTrendPoint {
	month: string;
	label: string;
	incomeCentavos: bigint;
	expensesCentavos: bigint;
}

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/**
 * Sum all balanceCentavos across partitions.
 */
export function computeTotalBalance(partitions: readonly PartitionRow[]): bigint {
	return partitions.reduce((sum, p) => sum + p.balanceCentavos, 0n);
}

/**
 * For each account: sum partition balances, derive type
 * ("Credit Card" if any partition has partitionType === "credit", else "Savings").
 * Returns AccountSummary[] sorted by name.
 */
export function computeAccountSummaries(
	accounts: readonly AccountRow[],
	partitions: readonly PartitionRow[],
): AccountSummary[] {
	return accounts
		.map((acct) => {
			const acctPartitions = partitions.filter((p) => p.accountId === acct.id);
			const balanceCentavos = acctPartitions.reduce((sum, p) => sum + p.balanceCentavos, 0n);
			const type = acctPartitions.some((p) => p.partitionType === "credit")
				? "Credit Card"
				: "Savings";
			return { id: acct.id, name: acct.name, type, balanceCentavos, iconBankId: acct.iconBankId };
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter to current month + expense type, group by tag, sum amounts, sort descending.
 */
export function computeSpendingByTag(transactions: readonly TransactionRow[]): SpendingByTag[] {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();

	const spentByTag = new Map<string, bigint>();
	for (const txn of transactions) {
		if (txn.type !== "expense") continue;
		const d = new Date(Number(txn.date.microsSinceUnixEpoch / 1000n));
		if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) continue;
		spentByTag.set(txn.tag, (spentByTag.get(txn.tag) ?? 0n) + txn.amountCentavos);
	}

	return Array.from(spentByTag.entries())
		.map(([tag, amountCentavos]) => ({ tag, amountCentavos }))
		.sort((a, b) =>
			a.amountCentavos > b.amountCentavos ? -1 : a.amountCentavos < b.amountCentavos ? 1 : 0,
		);
}

/**
 * For each of last N months (including current), sum income and expense amounts.
 * Returns MonthlyTrendPoint[] ordered oldest->newest.
 */
export function computeMonthlyTrend(
	transactions: readonly TransactionRow[],
	monthCount = 6,
): MonthlyTrendPoint[] {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();

	// Build month keys for the last N months
	const months: { year: number; month: number; key: string; label: string }[] = [];
	for (let i = monthCount - 1; i >= 0; i--) {
		const d = new Date(currentYear, currentMonth - i, 1);
		const y = d.getFullYear();
		const m = d.getMonth();
		const key = `${y}-${String(m + 1).padStart(2, "0")}`;
		months.push({ year: y, month: m, key, label: MONTH_LABELS[m] });
	}

	// Initialize result map
	const resultMap = new Map<string, { incomeCentavos: bigint; expensesCentavos: bigint }>();
	for (const mo of months) {
		resultMap.set(mo.key, { incomeCentavos: 0n, expensesCentavos: 0n });
	}

	// Aggregate transactions
	for (const txn of transactions) {
		if (txn.type !== "income" && txn.type !== "expense") continue;
		const d = new Date(Number(txn.date.microsSinceUnixEpoch / 1000n));
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const entry = resultMap.get(key);
		if (!entry) continue;
		if (txn.type === "income") {
			entry.incomeCentavos += txn.amountCentavos;
		} else {
			entry.expensesCentavos += txn.amountCentavos;
		}
	}

	return months.map((mo) => {
		const entry = resultMap.get(mo.key)!;
		return {
			month: mo.key,
			label: mo.label,
			incomeCentavos: entry.incomeCentavos,
			expensesCentavos: entry.expensesCentavos,
		};
	});
}
