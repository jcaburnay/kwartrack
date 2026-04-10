/**
 * Dashboard computation utility — pure functions for DashboardPage.
 * No side effects, no SpacetimeDB imports.
 * All monetary values are BigInt centavos (i64 from SpacetimeDB).
 */

interface SubAccountRow {
	id: bigint;
	accountId: bigint;
	name: string;
	balanceCentavos: bigint;
	isDefault: boolean;
	subAccountType: string;
	creditLimitCentavos: bigint;
}

interface AccountRow {
	id: bigint;
	name: string;
	iconBankId?: string | null;
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
 * Sum all balanceCentavos across sub-accounts.
 */
export function computeTotalBalance(subAccounts: readonly SubAccountRow[]): bigint {
	return subAccounts.reduce((sum, sa) => sum + sa.balanceCentavos, 0n);
}

/**
 * For each account: sum sub-account balances, derive type
 * ("Credit Card" if any sub-account has subAccountType === "credit", else "Savings").
 * Returns AccountSummary[] sorted by name.
 */
export function computeAccountSummaries(
	accounts: readonly AccountRow[],
	subAccounts: readonly SubAccountRow[],
): AccountSummary[] {
	return accounts
		.map((acct) => {
			const acctSubAccounts = subAccounts.filter((sa) => sa.accountId === acct.id);
			const balanceCentavos = acctSubAccounts.reduce((sum, sa) => sum + sa.balanceCentavos, 0n);
			const type = acctSubAccounts.some((sa) => sa.subAccountType === "credit")
				? "Credit Card"
				: "Savings";
			return {
				id: acct.id,
				name: acct.name,
				type,
				balanceCentavos,
				iconBankId: acct.iconBankId ?? undefined,
			};
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
