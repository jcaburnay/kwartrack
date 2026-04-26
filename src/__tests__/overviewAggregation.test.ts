import { describe, expect, it } from "vitest";
import {
	bucketSpendByMonth,
	type SpendInputRow,
	selectTopTagsByActual,
} from "../utils/overviewAggregation";

type AllocStub = { tag_id: string; amount_centavos: number };
type TagStub = { id: string; name: string };

const TZ = "Asia/Manila";

describe("bucketSpendByMonth", () => {
	it("returns exactly 12 month buckets oldest → newest anchored on today's month", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const result = bucketSpendByMonth([], today, TZ);
		expect(result).toHaveLength(12);
		expect(result[0].monthISO).toBe("2025-05");
		expect(result[11].monthISO).toBe("2026-04");
		expect(result.every((r) => r.totalCentavos === 0)).toBe(true);
	});

	it("sums effectiveCentavos into the matching month bucket", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const rows: SpendInputRow[] = [
			{ date: "2026-04-01", effectiveCentavos: 100_00 },
			{ date: "2026-04-30", effectiveCentavos: 50_00 },
			{ date: "2026-03-01", effectiveCentavos: 25_00 },
			{ date: "2025-05-15", effectiveCentavos: 7_00 },
		];
		const result = bucketSpendByMonth(rows, today, TZ);
		const apr = result.find((r) => r.monthISO === "2026-04");
		const mar = result.find((r) => r.monthISO === "2026-03");
		const may25 = result.find((r) => r.monthISO === "2025-05");
		expect(apr?.totalCentavos).toBe(150_00);
		expect(mar?.totalCentavos).toBe(25_00);
		expect(may25?.totalCentavos).toBe(7_00);
	});

	it("ignores rows outside the 12-month window", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const rows: SpendInputRow[] = [
			{ date: "2025-04-30", effectiveCentavos: 9999_00 }, // 1 day before window starts
			{ date: "2026-04-15", effectiveCentavos: 1_00 },
		];
		const result = bucketSpendByMonth(rows, today, TZ);
		const total = result.reduce((acc, r) => acc + r.totalCentavos, 0);
		expect(total).toBe(1_00);
	});

	it("formats monthLabel via Intl in the user's TZ", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const result = bucketSpendByMonth([], today, TZ);
		expect(result[11].monthLabel).toBe("April 2026");
		expect(result[0].monthLabel).toBe("May 2025");
	});
});

describe("selectTopTagsByActual", () => {
	const tags: TagStub[] = [
		{ id: "t1", name: "foods" },
		{ id: "t2", name: "transportation" },
		{ id: "t3", name: "bills" },
		{ id: "t4", name: "entertainment" },
		{ id: "t5", name: "online-shopping" },
		{ id: "t6", name: "pets" },
	];
	const allocations: AllocStub[] = [
		{ tag_id: "t1", amount_centavos: 1000_00 },
		{ tag_id: "t2", amount_centavos: 500_00 },
		{ tag_id: "t3", amount_centavos: 300_00 },
		{ tag_id: "t4", amount_centavos: 200_00 },
		{ tag_id: "t5", amount_centavos: 100_00 },
		{ tag_id: "t6", amount_centavos: 50_00 },
	];

	it("returns top N allocated tags by actual descending", () => {
		const actuals = new Map([
			["t1", 600_00],
			["t2", 700_00],
			["t3", 100_00],
			["t4", 50_00],
			["t5", 30_00],
			["t6", 10_00],
		]);
		const result = selectTopTagsByActual(actuals, allocations, tags, 5);
		expect(result.map((r) => r.tagId)).toEqual(["t2", "t1", "t3", "t4", "t5"]);
		expect(result[0]).toEqual({
			tagId: "t2",
			tagName: "transportation",
			actualCentavos: 700_00,
			budgetCentavos: 500_00,
			pct: 700_00 / 500_00,
		});
	});

	it("breaks ties by tag name (deterministic)", () => {
		const actuals = new Map([
			["t1", 100_00],
			["t2", 100_00],
			["t3", 100_00],
		]);
		const result = selectTopTagsByActual(actuals, allocations, tags, 5);
		// Tied at 100_00 each → bills, foods, transportation alphabetically
		expect(result.map((r) => r.tagName)).toEqual(["bills", "foods", "transportation"]);
	});

	it("excludes zero-actual rows", () => {
		const actuals = new Map([
			["t1", 100_00],
			["t2", 0],
		]);
		const result = selectTopTagsByActual(actuals, allocations, tags, 5);
		expect(result.map((r) => r.tagId)).toEqual(["t1"]);
	});

	it("excludes unallocated tags (Others bucket)", () => {
		const actuals = new Map([
			["t1", 100_00],
			["unallocated", 500_00],
		]);
		const result = selectTopTagsByActual(actuals, allocations, tags, 5);
		expect(result.map((r) => r.tagId)).toEqual(["t1"]);
	});

	it("returns fewer than N when not enough qualify", () => {
		const actuals = new Map([["t1", 100_00]]);
		const result = selectTopTagsByActual(actuals, allocations, tags, 5);
		expect(result).toHaveLength(1);
	});
});
