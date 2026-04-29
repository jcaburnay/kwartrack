/**
 * Summarise this-month inflow / outflow for a specific account. Used by
 * the simple detail strip (cash / e-wallet / savings).
 *
 * Inflow includes: income.to=account, transfer.to=account.
 * Outflow includes: expense.from=account, transfer.from=account, and any
 * paired 'transfer-fees' expense sourced from this account. The paired child
 * rows are included because budget math and user-facing "money out" should
 * reflect the fee the bank took.
 */
import { monthBounds } from "./dateRange";
import type { Transaction } from "./transactionFilters";

export type MonthSummary = {
	inflowCentavos: number;
	outflowCentavos: number;
};

export function summariseThisMonth(
	transactions: readonly Transaction[],
	accountId: string,
	timezone: string,
	today: Date = new Date(),
): MonthSummary {
	const { startISO, endExclusiveISO } = monthBounds(timezone, today);
	let inflow = 0;
	let outflow = 0;
	for (const tx of transactions) {
		if (tx.date < startISO || tx.date >= endExclusiveISO) continue;
		if (tx.type === "expense" && tx.from_account_id === accountId) {
			outflow += tx.amount_centavos;
		} else if (tx.type === "income" && tx.to_account_id === accountId) {
			inflow += tx.amount_centavos;
		} else if (tx.type === "transfer") {
			if (tx.from_account_id === accountId) outflow += tx.amount_centavos;
			if (tx.to_account_id === accountId) inflow += tx.amount_centavos;
		}
	}
	return { inflowCentavos: inflow, outflowCentavos: outflow };
}

export type NetFlowSummary = {
	inflowCentavos: number;
	outflowCentavos: number;
	netCentavos: number;
};

/**
 * Sum income inflows minus expense outflows for the current calendar month
 * (in user's timezone). Transfers themselves are excluded — they move money
 * between the user's own accounts and net to zero from a "money in vs out"
 * view. Note: paired transfer-fee child rows (stored as `expense` type) ARE
 * counted as outflow, because the bank actually took the fee.
 */
export function summariseNetFlowThisMonth(
	transactions: readonly Transaction[],
	timezone: string,
	today: Date = new Date(),
): NetFlowSummary {
	const { startISO, endExclusiveISO } = monthBounds(timezone, today);
	let inflow = 0;
	let outflow = 0;
	for (const tx of transactions) {
		if (tx.date < startISO || tx.date >= endExclusiveISO) continue;
		if (tx.type === "income") inflow += tx.amount_centavos;
		else if (tx.type === "expense") outflow += tx.amount_centavos;
	}
	return { inflowCentavos: inflow, outflowCentavos: outflow, netCentavos: inflow - outflow };
}
