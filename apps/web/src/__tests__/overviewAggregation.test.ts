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

import type { DebtRow } from "../utils/debtFilters";
import { selectUpcoming } from "../utils/overviewAggregation";
import type { Recurring } from "../utils/recurringFilters";

const TODAY = new Date("2026-04-15T08:00:00Z"); // 2026-04-15 in Asia/Manila

function mkRecurring(
	p: Partial<Recurring> & Pick<Recurring, "id" | "service" | "next_occurrence_at">,
): Recurring {
	return {
		id: p.id,
		user_id: "u1",
		service: p.service,
		amount_centavos: 100_00,
		type: "expense",
		tag_id: "t1",
		from_account_id: "a1",
		to_account_id: null,
		fee_centavos: null,
		description: null,
		interval: "monthly",
		first_occurrence_date: "2026-01-01",
		next_occurrence_at: p.next_occurrence_at,
		remaining_occurrences: null,
		is_paused: p.is_paused ?? false,
		is_completed: p.is_completed ?? false,
		completed_at: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	};
}

function mkDebt(
	p: Partial<DebtRow> & Pick<DebtRow, "id" | "personName" | "direction" | "date">,
): DebtRow {
	return {
		id: p.id,
		personId: "p1",
		personName: p.personName,
		direction: p.direction,
		amountCentavos: p.amountCentavos ?? 1000_00,
		settledCentavos: p.settledCentavos ?? 0,
		tagId: null,
		tagName: null,
		date: p.date,
		description: null,
		splitId: null,
	};
}

describe("selectUpcoming", () => {
	const tags = [{ id: "t1", name: "foods" }];
	const allocations = [{ tag_id: "t1", amount_centavos: 1000_00 }];
	const emptyActuals = new Map<string, number>();

	it("includes recurrings within next 7 days, sorted by daysAway ascending", () => {
		const recurrings: Recurring[] = [
			mkRecurring({ id: "r1", service: "Spotify", next_occurrence_at: "2026-04-18T16:00:00Z" }), // 3 days
			mkRecurring({ id: "r2", service: "Netflix", next_occurrence_at: "2026-04-16T16:00:00Z" }), // 1 day
		];
		const result = selectUpcoming(
			recurrings,
			[],
			emptyActuals,
			allocations,
			tags,
			TODAY,
			"Asia/Manila",
			5,
		);
		expect(result.map((i) => i.kind === "recurring" && i.id)).toEqual(["r2", "r1"]);
	});

	it("excludes paused, completed, and >7-day recurrings", () => {
		const recurrings: Recurring[] = [
			mkRecurring({ id: "r1", service: "active", next_occurrence_at: "2026-04-18T16:00:00Z" }),
			mkRecurring({
				id: "r2",
				service: "paused",
				next_occurrence_at: "2026-04-18T16:00:00Z",
				is_paused: true,
			}),
			mkRecurring({
				id: "r3",
				service: "done",
				next_occurrence_at: "2026-04-18T16:00:00Z",
				is_completed: true,
			}),
			mkRecurring({ id: "r4", service: "far", next_occurrence_at: "2026-04-25T16:00:00Z" }), // 10 days
		];
		const result = selectUpcoming(
			recurrings,
			[],
			emptyActuals,
			allocations,
			tags,
			TODAY,
			"Asia/Manila",
			5,
		);
		expect(result.map((i) => i.kind === "recurring" && i.id)).toEqual(["r1"]);
	});

	it("treats overdue recurrings as daysAway=0", () => {
		const recurrings: Recurring[] = [
			mkRecurring({ id: "r1", service: "overdue", next_occurrence_at: "2026-04-10T16:00:00Z" }), // 5 days ago
		];
		const result = selectUpcoming(
			recurrings,
			[],
			emptyActuals,
			allocations,
			tags,
			TODAY,
			"Asia/Manila",
			5,
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ kind: "recurring", id: "r1", daysAway: 0 });
	});

	it("includes loaned debts ≥14 days old, oldest first, after recurrings", () => {
		const recurrings = [
			mkRecurring({ id: "r1", service: "Spotify", next_occurrence_at: "2026-04-18T16:00:00Z" }),
		];
		const debts: DebtRow[] = [
			mkDebt({ id: "d1", personName: "Alice", direction: "loaned", date: "2026-04-01" }), // 14 days
			mkDebt({ id: "d2", personName: "Bob", direction: "loaned", date: "2026-03-15" }), // 31 days
		];
		const result = selectUpcoming(
			recurrings,
			debts,
			emptyActuals,
			allocations,
			tags,
			TODAY,
			"Asia/Manila",
			5,
		);
		expect(result.map((i) => i.kind === "loaned-debt" && i.id).filter(Boolean)).toEqual([
			"d2",
			"d1",
		]);
	});

	it("excludes debts <14 days, owed-direction, and fully-settled", () => {
		const debts: DebtRow[] = [
			mkDebt({ id: "d1", personName: "fresh", direction: "loaned", date: "2026-04-05" }), // 10 days, too new
			mkDebt({ id: "d2", personName: "owed", direction: "owed", date: "2026-03-15" }),
			mkDebt({
				id: "d3",
				personName: "paid",
				direction: "loaned",
				date: "2026-03-15",
				amountCentavos: 1000_00,
				settledCentavos: 1000_00,
			}),
		];
		const result = selectUpcoming(
			[],
			debts,
			emptyActuals,
			allocations,
			tags,
			TODAY,
			"Asia/Manila",
			5,
		);
		expect(result).toHaveLength(0);
	});

	it("includes budget warnings ≥80% with ≥1 day left, sorted by pct desc", () => {
		const allocs = [
			{ tag_id: "t1", amount_centavos: 1000_00 },
			{ tag_id: "t2", amount_centavos: 500_00 },
		];
		const tagsTwo = [
			{ id: "t1", name: "foods" },
			{ id: "t2", name: "bills" },
		];
		const actuals = new Map([
			["t1", 850_00], // 85%
			["t2", 480_00], // 96%
		]);
		const result = selectUpcoming([], [], actuals, allocs, tagsTwo, TODAY, "Asia/Manila", 5);
		expect(result.map((i) => i.kind === "budget-warning" && i.tagId).filter(Boolean)).toEqual([
			"t2",
			"t1",
		]);
	});

	it("excludes budget warnings on the last day of the month", () => {
		const lastDay = new Date("2026-04-30T08:00:00Z"); // Apr 30 in Asia/Manila
		const actuals = new Map([["t1", 850_00]]);
		const result = selectUpcoming([], [], actuals, allocations, tags, lastDay, "Asia/Manila", 5);
		expect(result).toHaveLength(0);
	});

	it("orders strictly: recurrings → debts → warnings; caps at max", () => {
		const recurrings = [
			mkRecurring({ id: "r1", service: "x", next_occurrence_at: "2026-04-18T16:00:00Z" }),
		];
		const debts = [mkDebt({ id: "d1", personName: "A", direction: "loaned", date: "2026-03-15" })];
		const actuals = new Map([["t1", 850_00]]);
		const result = selectUpcoming(
			recurrings,
			debts,
			actuals,
			allocations,
			tags,
			TODAY,
			"Asia/Manila",
			2,
		);
		expect(result.map((i) => i.kind)).toEqual(["recurring", "loaned-debt"]);
	});

	it("returns empty when nothing qualifies", () => {
		const result = selectUpcoming([], [], emptyActuals, allocations, tags, TODAY, "Asia/Manila", 5);
		expect(result).toEqual([]);
	});
});
