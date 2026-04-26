import { describe, expect, it } from "vitest";
import type { Transaction } from "../utils/transactionFilters";
import { summariseThisMonth } from "../utils/transactionSummary";

function tx(p: Partial<Transaction> & Pick<Transaction, "id" | "type" | "date">): Transaction {
	return {
		amount_centavos: 0,
		created_at: "",
		description: null,
		fee_centavos: null,
		from_account_id: null,
		parent_transaction_id: null,
		recurring_id: null,
		tag_id: null,
		to_account_id: null,
		updated_at: "",
		user_id: "u1",
		debt_id: null,
		split_id: null,
		...p,
	};
}

const today = new Date("2026-04-15T10:00:00Z");

describe("summariseThisMonth", () => {
	it("sums only in-month transactions", () => {
		const txs: Transaction[] = [
			tx({
				id: "1",
				type: "expense",
				date: "2026-04-02",
				from_account_id: "cash",
				amount_centavos: 100_00,
			}),
			tx({
				id: "2",
				type: "expense",
				date: "2026-03-30",
				from_account_id: "cash",
				amount_centavos: 50_00,
			}), // out of month
			tx({
				id: "3",
				type: "income",
				date: "2026-04-10",
				to_account_id: "cash",
				amount_centavos: 75_00,
			}),
		];
		const result = summariseThisMonth(txs, "cash", "Asia/Manila", today);
		expect(result.outflowCentavos).toBe(100_00);
		expect(result.inflowCentavos).toBe(75_00);
	});

	it("transfers count on both accounts", () => {
		const txs: Transaction[] = [
			tx({
				id: "1",
				type: "transfer",
				date: "2026-04-05",
				from_account_id: "cash",
				to_account_id: "wallet",
				amount_centavos: 300_00,
			}),
		];
		expect(summariseThisMonth(txs, "cash", "Asia/Manila", today).outflowCentavos).toBe(300_00);
		expect(summariseThisMonth(txs, "wallet", "Asia/Manila", today).inflowCentavos).toBe(300_00);
	});

	it("includes paired 'transfer-fees' children as outflow", () => {
		const txs: Transaction[] = [
			tx({
				id: "fee",
				type: "expense",
				date: "2026-04-05",
				from_account_id: "cash",
				amount_centavos: 5_00,
				parent_transaction_id: "parent",
				tag_id: "transfer-fees",
			}),
		];
		expect(summariseThisMonth(txs, "cash", "Asia/Manila", today).outflowCentavos).toBe(5_00);
	});
});
