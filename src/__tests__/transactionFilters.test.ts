import { describe, expect, it } from "vitest";
import {
	type AccountLookup,
	EMPTY_FILTERS,
	matchesFilters,
	type Transaction,
} from "../utils/transactionFilters";

function tx(p: Partial<Transaction> & Pick<Transaction, "id" | "type" | "date">): Transaction {
	return {
		amount_centavos: 100,
		created_at: "2026-04-24T00:00:00Z",
		description: null,
		fee_centavos: null,
		from_account_id: null,
		parent_transaction_id: null,
		recurring_id: null,
		tag_id: null,
		to_account_id: null,
		updated_at: "2026-04-24T00:00:00Z",
		user_id: "u1",
		debt_id: null,
		split_id: null,
		is_installment_portion: false,
		...p,
	};
}

const accounts = new Map<string, AccountLookup>([
	["cash", { id: "cash", groupId: null }],
	["maya-wallet", { id: "maya-wallet", groupId: "maya" }],
	["maya-goal", { id: "maya-goal", groupId: "maya" }],
]);

describe("matchesFilters", () => {
	const base = tx({ id: "x", type: "expense", date: "2026-04-10", from_account_id: "cash" });

	it("no filters matches everything", () => {
		expect(matchesFilters(base, EMPTY_FILTERS, accounts)).toBe(true);
	});

	it("type filter", () => {
		expect(matchesFilters(base, { ...EMPTY_FILTERS, type: "expense" }, accounts)).toBe(true);
		expect(matchesFilters(base, { ...EMPTY_FILTERS, type: "income" }, accounts)).toBe(false);
	});

	it("account filter checks both from and to", () => {
		expect(matchesFilters(base, { ...EMPTY_FILTERS, accountId: "cash" }, accounts)).toBe(true);
		const inbound = tx({
			id: "y",
			type: "income",
			date: "2026-04-10",
			to_account_id: "cash",
		});
		expect(matchesFilters(inbound, { ...EMPTY_FILTERS, accountId: "cash" }, accounts)).toBe(true);
		expect(matchesFilters(base, { ...EMPTY_FILTERS, accountId: "maya-wallet" }, accounts)).toBe(
			false,
		);
	});

	it("group filter matches any member", () => {
		const mayaTx = tx({
			id: "z",
			type: "expense",
			date: "2026-04-10",
			from_account_id: "maya-wallet",
		});
		expect(matchesFilters(mayaTx, { ...EMPTY_FILTERS, groupId: "maya" }, accounts)).toBe(true);
		expect(matchesFilters(base, { ...EMPTY_FILTERS, groupId: "maya" }, accounts)).toBe(false);
	});

	it("date range is inclusive on both ends", () => {
		const may = tx({ id: "m", type: "expense", date: "2026-05-01", from_account_id: "cash" });
		expect(
			matchesFilters(
				may,
				{ ...EMPTY_FILTERS, dateFrom: "2026-05-01", dateTo: "2026-05-01" },
				accounts,
			),
		).toBe(true);
		expect(
			matchesFilters(
				base,
				{ ...EMPTY_FILTERS, dateFrom: "2026-04-11", dateTo: "2026-04-20" },
				accounts,
			),
		).toBe(false);
	});

	it("tag filter", () => {
		const tagged = tx({
			id: "t",
			type: "expense",
			date: "2026-04-10",
			from_account_id: "cash",
			tag_id: "foods",
		});
		expect(matchesFilters(tagged, { ...EMPTY_FILTERS, tagId: "foods" }, accounts)).toBe(true);
		expect(matchesFilters(tagged, { ...EMPTY_FILTERS, tagId: "bills" }, accounts)).toBe(false);
	});
});
