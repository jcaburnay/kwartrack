import { describe, expect, it } from "vitest";
import type { Recurring } from "../utils/recurringFilters";
import { summariseRecurrings } from "../utils/recurringSummary";

const ts = "2026-04-26T00:00:00Z";

function rec(p: Partial<Recurring> & Pick<Recurring, "id">): Recurring {
	return {
		amount_centavos: 100_00,
		completed_at: null,
		created_at: ts,
		description: null,
		fee_centavos: null,
		first_occurrence_date: "2026-04-26",
		from_account_id: "cash",
		interval: "monthly",
		is_completed: false,
		is_paused: false,
		next_occurrence_at: "2026-04-30T00:00:00Z",
		remaining_occurrences: null,
		service: "Spotify",
		tag_id: "music",
		to_account_id: null,
		type: "expense",
		updated_at: ts,
		user_id: "u1",
		...p,
	};
}

describe("summariseRecurrings", () => {
	it("returns zeros and null nextDue for an empty list", () => {
		const s = summariseRecurrings([]);
		expect(s).toEqual({
			activeCount: 0,
			pausedCount: 0,
			completedCount: 0,
			monthlyOutflowCentavos: 0,
			nextDue: null,
		});
	});

	it("counts an active monthly expense as 1 active and adds full amount to monthly outflow", () => {
		const s = summariseRecurrings([rec({ id: "1", amount_centavos: 14_900, interval: "monthly" })]);
		expect(s.activeCount).toBe(1);
		expect(s.monthlyOutflowCentavos).toBe(14_900);
	});

	it("normalises weekly recurrings by × 4.345 (rounded to nearest centavo)", () => {
		const s = summariseRecurrings([rec({ id: "1", amount_centavos: 1_000, interval: "weekly" })]);
		// 1000 × 4.345 = 4345
		expect(s.monthlyOutflowCentavos).toBe(4_345);
	});

	it("normalises quarterly recurrings by ÷ 3", () => {
		const s = summariseRecurrings([
			rec({ id: "1", amount_centavos: 30_000, interval: "quarterly" }),
		]);
		expect(s.monthlyOutflowCentavos).toBe(10_000);
	});

	it("normalises semi-annual recurrings by ÷ 6", () => {
		const s = summariseRecurrings([
			rec({ id: "1", amount_centavos: 60_000, interval: "semi_annual" }),
		]);
		expect(s.monthlyOutflowCentavos).toBe(10_000);
	});

	it("normalises annual recurrings by ÷ 12", () => {
		const s = summariseRecurrings([rec({ id: "1", amount_centavos: 120_000, interval: "annual" })]);
		expect(s.monthlyOutflowCentavos).toBe(10_000);
	});

	it("excludes paused recurrings from active count and monthly outflow", () => {
		const s = summariseRecurrings([rec({ id: "1", is_paused: true, amount_centavos: 99_999 })]);
		expect(s.activeCount).toBe(0);
		expect(s.pausedCount).toBe(1);
		expect(s.monthlyOutflowCentavos).toBe(0);
	});

	it("excludes completed recurrings from active count and monthly outflow", () => {
		const s = summariseRecurrings([
			rec({
				id: "1",
				is_completed: true,
				completed_at: ts,
				remaining_occurrences: 0,
				amount_centavos: 99_999,
			}),
		]);
		expect(s.activeCount).toBe(0);
		expect(s.completedCount).toBe(1);
		expect(s.monthlyOutflowCentavos).toBe(0);
	});

	it("excludes income from monthly outflow (counts only expense + transfer)", () => {
		const s = summariseRecurrings([
			rec({
				id: "income",
				type: "income",
				from_account_id: null,
				to_account_id: "savings",
				amount_centavos: 45_000_00,
			}),
			rec({ id: "expense", type: "expense", amount_centavos: 1_000 }),
		]);
		expect(s.activeCount).toBe(2);
		expect(s.monthlyOutflowCentavos).toBe(1_000);
	});

	it("counts transfers in the monthly outflow (subs out)", () => {
		const s = summariseRecurrings([
			rec({
				id: "1",
				type: "transfer",
				from_account_id: "a",
				to_account_id: "b",
				tag_id: null,
				amount_centavos: 5_000,
			}),
		]);
		expect(s.monthlyOutflowCentavos).toBe(5_000);
	});

	it("picks the active row with the smallest next_occurrence_at as nextDue", () => {
		const s = summariseRecurrings([
			rec({
				id: "later",
				service: "Netflix",
				next_occurrence_at: "2026-05-15T00:00:00Z",
			}),
			rec({
				id: "soonest",
				service: "Spotify",
				next_occurrence_at: "2026-04-30T00:00:00Z",
			}),
			rec({
				id: "paused-but-soonest",
				service: "Paused thing",
				is_paused: true,
				next_occurrence_at: "2026-04-28T00:00:00Z",
			}),
		]);
		expect(s.nextDue).toEqual({ service: "Spotify", date: "2026-04-30T00:00:00Z" });
	});

	it("returns null nextDue when no active recurrings", () => {
		const s = summariseRecurrings([rec({ id: "1", is_paused: true })]);
		expect(s.nextDue).toBeNull();
	});
});
