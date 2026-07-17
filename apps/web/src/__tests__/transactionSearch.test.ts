import { describe, expect, it } from "vitest";
import type { Transaction } from "../utils/transactionFilters";
import { matchesTransactionSearch } from "../utils/transactionSearch";

const accountsById = new Map([
	["a1", "BPI Card"],
	["a2", "BDO Savings"],
]);
const tagsById = new Map([
	["t1", "Groceries"],
	["t2", "Salary"],
]);

const baseTx: Omit<Transaction, "id" | "type" | "date" | "amount_centavos"> = {
	user_id: "u1",
	from_account_id: null,
	to_account_id: null,
	tag_id: null,
	description: null,
	fee_centavos: null,
	created_at: "2026-04-15T03:00:00Z",
	updated_at: "2026-04-15T03:00:00Z",
	recurring_id: null,
	split_id: null,
	debt_id: null,
	parent_transaction_id: null,
	is_installment_portion: false,
};

function tx(p: Partial<Transaction>): Transaction {
	return {
		id: "x",
		type: "expense",
		date: "2026-04-10",
		amount_centavos: 100_00,
		...baseTx,
		...p,
	};
}

describe("matchesTransactionSearch", () => {
	it("returns true for empty query", () => {
		expect(matchesTransactionSearch(tx({}), "", accountsById, tagsById)).toBe(true);
		expect(matchesTransactionSearch(tx({}), "   ", accountsById, tagsById)).toBe(true);
	});

	it("matches description case-insensitively", () => {
		const t = tx({ description: "SM Hypermarket" });
		expect(matchesTransactionSearch(t, "hyper", accountsById, tagsById)).toBe(true);
		expect(matchesTransactionSearch(t, "HYPER", accountsById, tagsById)).toBe(true);
		expect(matchesTransactionSearch(t, "puregold", accountsById, tagsById)).toBe(false);
	});

	it("matches tag name", () => {
		const t = tx({ tag_id: "t1" });
		expect(matchesTransactionSearch(t, "groc", accountsById, tagsById)).toBe(true);
		expect(matchesTransactionSearch(t, "salary", accountsById, tagsById)).toBe(false);
	});

	it("matches from-account name", () => {
		const t = tx({ from_account_id: "a1" });
		expect(matchesTransactionSearch(t, "bpi", accountsById, tagsById)).toBe(true);
	});

	it("matches to-account name (transfer or income)", () => {
		const t = tx({ type: "income", from_account_id: null, to_account_id: "a2" });
		expect(matchesTransactionSearch(t, "bdo", accountsById, tagsById)).toBe(true);
	});

	it("ignores missing tag / account references gracefully", () => {
		const t = tx({ tag_id: "missing", from_account_id: "missing" });
		expect(matchesTransactionSearch(t, "anything", accountsById, tagsById)).toBe(false);
	});

	it("trims surrounding whitespace from the query", () => {
		const t = tx({ description: "Coffee" });
		expect(matchesTransactionSearch(t, "  coffee  ", accountsById, tagsById)).toBe(true);
	});
});
