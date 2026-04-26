import { describe, expect, it } from "vitest";
import {
	computeActualsByTag,
	computeOthersCentavos,
	computeOverallActualCentavos,
	progressBucket,
} from "../utils/budgetMath";
import type { Transaction } from "../utils/transactionFilters";

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
		...p,
	};
}

describe("computeActualsByTag", () => {
	it("sums expense rows by tag for the given month", () => {
		const txs: Transaction[] = [
			tx({
				id: "1",
				type: "expense",
				date: "2026-04-02",
				tag_id: "foods",
				amount_centavos: 100_00,
			}),
			tx({
				id: "2",
				type: "expense",
				date: "2026-04-15",
				tag_id: "foods",
				amount_centavos: 50_00,
			}),
			tx({ id: "3", type: "expense", date: "2026-04-20", tag_id: "pets", amount_centavos: 200_00 }),
		];
		const actuals = computeActualsByTag(txs, "2026-04");
		expect(actuals.get("foods")).toBe(150_00);
		expect(actuals.get("pets")).toBe(200_00);
	});

	it("includes paired transfer-fee children (parent_transaction_id set)", () => {
		const txs: Transaction[] = [
			tx({
				id: "fee-child",
				type: "expense",
				date: "2026-04-10",
				tag_id: "transfer-fees",
				amount_centavos: 25_00,
				parent_transaction_id: "parent-tx",
			}),
		];
		const actuals = computeActualsByTag(txs, "2026-04");
		expect(actuals.get("transfer-fees")).toBe(25_00);
	});

	it("excludes transactions outside the given month", () => {
		const txs: Transaction[] = [
			tx({
				id: "1",
				type: "expense",
				date: "2026-03-31",
				tag_id: "foods",
				amount_centavos: 100_00,
			}),
			tx({ id: "2", type: "expense", date: "2026-05-01", tag_id: "foods", amount_centavos: 50_00 }),
		];
		const actuals = computeActualsByTag(txs, "2026-04");
		expect(actuals.size).toBe(0);
	});

	it("ignores income and transfer rows", () => {
		const txs: Transaction[] = [
			tx({
				id: "1",
				type: "income",
				date: "2026-04-02",
				tag_id: "monthly-salary",
				amount_centavos: 50_000_00,
			}),
			tx({
				id: "2",
				type: "transfer",
				date: "2026-04-02",
				from_account_id: "a",
				to_account_id: "b",
				amount_centavos: 1_000_00,
			}),
		];
		const actuals = computeActualsByTag(txs, "2026-04");
		expect(actuals.size).toBe(0);
	});

	it("skips rows with null tag_id", () => {
		const txs: Transaction[] = [
			tx({ id: "1", type: "expense", date: "2026-04-02", tag_id: null, amount_centavos: 100_00 }),
		];
		const actuals = computeActualsByTag(txs, "2026-04");
		expect(actuals.size).toBe(0);
	});
});

describe("computeOthersCentavos", () => {
	it("sums only entries whose tag is NOT in the allocated set", () => {
		const actuals = new Map([
			["foods", 100_00],
			["pets", 200_00],
			["unbudgeted-tag", 50_00],
		]);
		const allocated = new Set(["foods", "pets"]);
		expect(computeOthersCentavos(actuals, allocated)).toBe(50_00);
	});

	it("returns 0 when every actual tag is allocated", () => {
		const actuals = new Map([["foods", 100_00]]);
		expect(computeOthersCentavos(actuals, new Set(["foods"]))).toBe(0);
	});

	it("returns the full sum when nothing is allocated", () => {
		const actuals = new Map([
			["foods", 100_00],
			["pets", 50_00],
		]);
		expect(computeOthersCentavos(actuals, new Set())).toBe(150_00);
	});
});

describe("computeOverallActualCentavos", () => {
	it("sums every actual entry, allocated or not", () => {
		const actuals = new Map([
			["foods", 100_00],
			["pets", 200_00],
			["others", 50_00],
		]);
		expect(computeOverallActualCentavos(actuals)).toBe(350_00);
	});

	it("returns 0 for an empty map", () => {
		expect(computeOverallActualCentavos(new Map())).toBe(0);
	});
});

describe("progressBucket", () => {
	it("returns 'empty' when budget is 0 or negative", () => {
		expect(progressBucket(0, 0)).toBe("empty");
		expect(progressBucket(100, 0)).toBe("empty");
		expect(progressBucket(0, -1)).toBe("empty");
	});

	it("returns 'green' when actual < 80% of budget", () => {
		expect(progressBucket(0, 100)).toBe("green");
		expect(progressBucket(50, 100)).toBe("green");
		expect(progressBucket(7999, 10000)).toBe("green"); // 79.99%
	});

	it("returns 'orange' from 80% up to and including 100%", () => {
		expect(progressBucket(80, 100)).toBe("orange");
		expect(progressBucket(95, 100)).toBe("orange");
		expect(progressBucket(100, 100)).toBe("orange");
	});

	it("returns 'red' above 100%", () => {
		expect(progressBucket(101, 100)).toBe("red");
		expect(progressBucket(500, 100)).toBe("red");
	});
});
