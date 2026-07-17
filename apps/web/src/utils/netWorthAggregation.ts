/**
 * Pure aggregation helpers for the Net Worth bento box. No IO; deterministic;
 * fully unit-tested. The hooks layer composes existing fetchers
 * (`useAccounts`, `useTransactions`) and feeds already-shaped data here.
 */

import { type Account, type AccountType, computeNetWorth, isLiability } from "./accountBalances";
import { ACCOUNT_TYPE_LABEL } from "./accountValidation";
import { monthBounds } from "./dateRange";
import type { Transaction } from "./transactionFilters";

export type AssetMixSlice = {
	type: AccountType;
	label: string;
	centavos: number;
};

export type CashFlowPoint = {
	monthISO: string;
	monthLabel: string;
	incomeCentavos: number;
	expenseCentavos: number;
	netCentavos: number;
};

export type NetWorthPoint = {
	monthISO: string;
	monthLabel: string;
	netWorthCentavos: number;
};

/**
 * Compute the **forward** balance delta a transaction applies to a given
 * account, mirroring the `apply_transaction_balance_delta` Postgres trigger:
 *   - Asset accounts: money in (+), money out (−)
 *   - Liability (credit) accounts: sign flips — money in pays down debt (−),
 *     money out grows debt (+)
 *
 * Returns 0 if the transaction does not touch this account.
 */
function txDeltaForAccount(
	tx: Transaction,
	accountId: string,
	accountIsLiability: boolean,
): number {
	const amt = tx.amount_centavos;
	if (tx.type === "expense" && tx.from_account_id === accountId) {
		return accountIsLiability ? amt : -amt;
	}
	if (tx.type === "income" && tx.to_account_id === accountId) {
		return accountIsLiability ? -amt : amt;
	}
	if (tx.type === "transfer") {
		if (tx.from_account_id === accountId) return accountIsLiability ? amt : -amt;
		if (tx.to_account_id === accountId) return accountIsLiability ? -amt : amt;
	}
	return 0;
}

/**
 * Per-month net worth over the last `monthCount` calendar months in the user's
 * TZ, oldest → newest. The current month bucket reflects net worth *as of
 * today*; older buckets reflect net worth at the end of that month.
 *
 * No balance-history table exists. We compute snapshots by walking backward
 * from each non-archived account's current balance, reversing transactions in
 * later months. Sign-flips for credit accounts match the DB trigger.
 *
 * Transfers are net-zero on net worth (one account loses what another gains)
 * so they cancel out across the sum.
 */
export function bucketNetWorthByMonth(
	accounts: readonly Account[],
	transactions: readonly Transaction[],
	today: Date,
	timezone: string,
	monthCount: number,
): NetWorthPoint[] {
	const months: NetWorthPoint[] = [];
	for (let i = monthCount - 1; i >= 0; i--) {
		const anchor = new Date(today);
		anchor.setMonth(anchor.getMonth() - i);
		const bounds = monthBounds(timezone, anchor);
		months.push({
			monthISO: bounds.startISO.slice(0, 7),
			monthLabel: bounds.monthLabel,
			netWorthCentavos: 0,
		});
	}
	const indexByISO = new Map(months.map((m, i) => [m.monthISO, i]));

	for (const account of accounts) {
		if (account.is_archived) continue;
		const isLia = isLiability(account);

		// Sum deltas per month for this account.
		const deltaByMonth = new Array<number>(monthCount).fill(0);
		for (const tx of transactions) {
			const monthISO = tx.date.slice(0, 7);
			const idx = indexByISO.get(monthISO);
			if (idx === undefined) continue;
			deltaByMonth[idx] += txDeltaForAccount(tx, account.id, isLia);
		}

		// Walk newest → oldest. Newest bucket = current balance.
		// Each older bucket = next-newer bucket minus deltas in the next-newer month.
		const balances = new Array<number>(monthCount);
		balances[monthCount - 1] = account.balance_centavos;
		for (let i = monthCount - 2; i >= 0; i--) {
			balances[i] = balances[i + 1] - deltaByMonth[i + 1];
		}

		// Roll into net worth.
		const sign = isLia ? -1 : 1;
		for (let i = 0; i < monthCount; i++) {
			months[i].netWorthCentavos += sign * balances[i];
		}
	}

	return months;
}

/**
 * Build a list of `monthCount` calendar-month buckets in the user's TZ, oldest
 * → newest, anchored on today's month. Each bucket sums income and expense
 * separately and exposes the net (income − expense). Transfer transactions are
 * ignored — they're neutral on cash flow.
 */
export function bucketCashFlowByMonth(
	transactions: readonly Transaction[],
	today: Date,
	timezone: string,
	monthCount: number,
): CashFlowPoint[] {
	const months: CashFlowPoint[] = [];
	for (let i = monthCount - 1; i >= 0; i--) {
		const anchor = new Date(today);
		anchor.setMonth(anchor.getMonth() - i);
		const bounds = monthBounds(timezone, anchor);
		months.push({
			monthISO: bounds.startISO.slice(0, 7),
			monthLabel: bounds.monthLabel,
			incomeCentavos: 0,
			expenseCentavos: 0,
			netCentavos: 0,
		});
	}
	const indexByISO = new Map(months.map((m, i) => [m.monthISO, i]));
	for (const tx of transactions) {
		if (tx.type === "transfer") continue;
		const idx = indexByISO.get(tx.date.slice(0, 7));
		if (idx === undefined) continue;
		if (tx.type === "income") months[idx].incomeCentavos += tx.amount_centavos;
		else months[idx].expenseCentavos += tx.amount_centavos;
	}
	for (const m of months) m.netCentavos = m.incomeCentavos - m.expenseCentavos;
	return months;
}

/**
 * Group non-archived asset accounts by `type`, sum balances, sort by total
 * descending. Liability (credit) accounts are excluded — they get their own
 * footnote in the Asset Mix UI.
 */
export function assetMixByType(accounts: readonly Account[]): AssetMixSlice[] {
	return groupByType(accounts, (a) => !isLiability(a));
}

/**
 * Same shape as `assetMixByType` but for liability (credit) accounts only.
 * Used as a small footnote under the Asset Mix donut.
 */
export function liabilitiesByType(accounts: readonly Account[]): AssetMixSlice[] {
	return groupByType(accounts, (a) => isLiability(a));
}

export type AccountBalanceRow = {
	accountId: string;
	name: string;
	centavos: number;
	isLiability: boolean;
};

/**
 * Non-archived accounts sorted by balance descending, with a `isLiability`
 * flag so the bar chart can color credit balances differently. Liabilities
 * keep their stored centavos (positive); the chart decides how to render them.
 */
export function accountsByBalance(accounts: readonly Account[]): AccountBalanceRow[] {
	return accounts
		.filter((a) => !a.is_archived)
		.map((a) => ({
			accountId: a.id,
			name: a.name,
			centavos: a.balance_centavos,
			isLiability: isLiability(a),
		}))
		.sort((a, b) => b.centavos - a.centavos);
}

export type MtdDelta = {
	deltaCentavos: number;
	percentOfCurrent: number; // 0.05 = 5%
};

/**
 * Month-to-date net worth delta: how much net worth has moved since the first
 * day of the user's current month (in their TZ). Net of income vs expense for
 * non-archived accounts; transfers cancel because they affect both sides.
 *
 * `percentOfCurrent` is delta / |current net worth| (clamped to 0 when current
 * is 0) so callers can apply a "significant drop" threshold.
 */
export function mtdNetWorthDelta(
	accounts: readonly Account[],
	transactions: readonly Transaction[],
	today: Date,
	timezone: string,
): MtdDelta {
	const bounds = monthBounds(timezone, today);
	const startOfMonthISO = bounds.startISO;

	let delta = 0;
	for (const account of accounts) {
		if (account.is_archived) continue;
		const isLia = isLiability(account);
		const sign = isLia ? -1 : 1;
		for (const tx of transactions) {
			if (tx.date < startOfMonthISO) continue;
			delta += sign * txDeltaForAccount(tx, account.id, isLia);
		}
	}

	const current = computeNetWorth(accounts).netWorthCentavos;
	const percentOfCurrent = current === 0 ? 0 : delta / Math.abs(current);
	return { deltaCentavos: delta, percentOfCurrent };
}

function groupByType(
	accounts: readonly Account[],
	predicate: (a: Account) => boolean,
): AssetMixSlice[] {
	const totals = new Map<AccountType, number>();
	for (const a of accounts) {
		if (a.is_archived) continue;
		if (!predicate(a)) continue;
		totals.set(a.type, (totals.get(a.type) ?? 0) + a.balance_centavos);
	}
	return [...totals.entries()]
		.map(([type, centavos]) => ({ type, label: ACCOUNT_TYPE_LABEL[type], centavos }))
		.sort((a, b) => b.centavos - a.centavos);
}
