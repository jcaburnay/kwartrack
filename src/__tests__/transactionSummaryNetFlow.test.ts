import { describe, expect, it } from "vitest";
import type { Transaction } from "../utils/transactionFilters";
import { summariseNetFlowThisMonth } from "../utils/transactionSummary";

const TZ = "Asia/Manila";
const today = new Date("2026-04-15T03:00:00Z"); // 11am Manila

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

function tx(
	overrides: Partial<Transaction> & Pick<Transaction, "type" | "date" | "amount_centavos">,
): Transaction {
	return {
		id: `${overrides.date}-${overrides.type}-${overrides.amount_centavos}`,
		...baseTx,
		...overrides,
	};
}

describe("summariseNetFlowThisMonth", () => {
	it("sums income minus expense for current month, ignoring transfers", () => {
		const txs: Transaction[] = [
			tx({ type: "income", date: "2026-04-01", amount_centavos: 50_000_00, to_account_id: "a1" }),
			tx({ type: "expense", date: "2026-04-05", amount_centavos: 1_250_00, from_account_id: "a1" }),
			tx({ type: "expense", date: "2026-04-10", amount_centavos: 2_400_00, from_account_id: "a1" }),
			tx({
				type: "transfer",
				date: "2026-04-12",
				amount_centavos: 5_000_00,
				from_account_id: "a1",
				to_account_id: "a2",
			}),
		];
		const result = summariseNetFlowThisMonth(txs, TZ, today);
		expect(result.inflowCentavos).toBe(50_000_00);
		expect(result.outflowCentavos).toBe(3_650_00);
		expect(result.netCentavos).toBe(46_350_00);
	});

	it("excludes transactions outside the current month", () => {
		const txs: Transaction[] = [
			tx({ type: "income", date: "2026-03-31", amount_centavos: 99_999_00, to_account_id: "a1" }),
			tx({
				type: "expense",
				date: "2026-05-01",
				amount_centavos: 88_888_00,
				from_account_id: "a1",
			}),
			tx({ type: "income", date: "2026-04-15", amount_centavos: 1_000_00, to_account_id: "a1" }),
		];
		const result = summariseNetFlowThisMonth(txs, TZ, today);
		expect(result.inflowCentavos).toBe(1_000_00);
		expect(result.outflowCentavos).toBe(0);
		expect(result.netCentavos).toBe(1_000_00);
	});

	it("returns zeros for empty list", () => {
		expect(summariseNetFlowThisMonth([], TZ, today)).toEqual({
			inflowCentavos: 0,
			outflowCentavos: 0,
			netCentavos: 0,
		});
	});
});
