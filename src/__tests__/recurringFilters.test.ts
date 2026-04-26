import { describe, expect, it } from "vitest";
import {
	DEFAULT_RECURRING_FILTERS,
	matchesRecurringFilters,
	type Recurring,
	type RecurringFilters,
	statusOf,
} from "../utils/recurringFilters";

function rec(p: Partial<Recurring> & Pick<Recurring, "id">): Recurring {
	return {
		amount_centavos: 100_00,
		completed_at: null,
		created_at: "2026-04-26T00:00:00Z",
		description: null,
		fee_centavos: null,
		first_occurrence_date: "2026-04-26",
		from_account_id: "acc-1",
		interval: "monthly",
		is_completed: false,
		is_paused: false,
		next_occurrence_at: "2026-04-26T16:00:00Z",
		remaining_occurrences: null,
		service: "Spotify",
		tag_id: "tag-1",
		to_account_id: null,
		type: "expense",
		updated_at: "2026-04-26T00:00:00Z",
		user_id: "u1",
		...p,
	};
}

const f = (override: Partial<RecurringFilters> = {}): RecurringFilters => ({
	...DEFAULT_RECURRING_FILTERS,
	...override,
});

describe("statusOf", () => {
	it("returns 'active' for non-paused, non-completed", () => {
		expect(statusOf(rec({ id: "1" }))).toBe("active");
	});
	it("returns 'paused' when is_paused", () => {
		expect(statusOf(rec({ id: "1", is_paused: true }))).toBe("paused");
	});
	it("returns 'completed' when is_completed (regardless of pause)", () => {
		expect(statusOf(rec({ id: "1", is_completed: true }))).toBe("completed");
		expect(statusOf(rec({ id: "1", is_completed: true, is_paused: true }))).toBe("completed");
	});
});

describe("matchesRecurringFilters — defaults", () => {
	it("includes active and paused by default", () => {
		expect(matchesRecurringFilters(rec({ id: "1" }), f())).toBe(true);
		expect(matchesRecurringFilters(rec({ id: "2", is_paused: true }), f())).toBe(true);
	});

	it("hides completed by default", () => {
		expect(
			matchesRecurringFilters(
				rec({ id: "1", is_completed: true, completed_at: "2026-04-25T00:00:00Z" }),
				f(),
			),
		).toBe(false);
	});

	it("shows completed when status filter includes 'completed'", () => {
		const filters = f({ statuses: new Set(["completed"]) });
		expect(
			matchesRecurringFilters(
				rec({ id: "1", is_completed: true, completed_at: "2026-04-25T00:00:00Z" }),
				filters,
			),
		).toBe(true);
	});
});

describe("matchesRecurringFilters — search", () => {
	it("matches case-insensitive substring on service", () => {
		expect(
			matchesRecurringFilters(rec({ id: "1", service: "Spotify Family" }), f({ search: "spot" })),
		).toBe(true);
		expect(
			matchesRecurringFilters(rec({ id: "1", service: "Spotify Family" }), f({ search: "FAMILY" })),
		).toBe(true);
	});

	it("rejects non-matching search", () => {
		expect(
			matchesRecurringFilters(rec({ id: "1", service: "Spotify" }), f({ search: "netflix" })),
		).toBe(false);
	});

	it("ignores whitespace-only search", () => {
		expect(
			matchesRecurringFilters(rec({ id: "1", service: "Spotify" }), f({ search: "   " })),
		).toBe(true);
	});
});

describe("matchesRecurringFilters — fields", () => {
	it("matches account on either from or to", () => {
		const r1 = rec({ id: "1", from_account_id: "a", to_account_id: null });
		const r2 = rec({ id: "2", from_account_id: null, to_account_id: "a" });
		expect(matchesRecurringFilters(r1, f({ accountId: "a" }))).toBe(true);
		expect(matchesRecurringFilters(r2, f({ accountId: "a" }))).toBe(true);
		expect(matchesRecurringFilters(r1, f({ accountId: "b" }))).toBe(false);
	});

	it("matches type exactly", () => {
		expect(matchesRecurringFilters(rec({ id: "1", type: "expense" }), f({ type: "expense" }))).toBe(
			true,
		);
		expect(matchesRecurringFilters(rec({ id: "1", type: "expense" }), f({ type: "income" }))).toBe(
			false,
		);
	});

	it("matches tag exactly", () => {
		expect(matchesRecurringFilters(rec({ id: "1", tag_id: "tag-x" }), f({ tagId: "tag-x" }))).toBe(
			true,
		);
		expect(matchesRecurringFilters(rec({ id: "1", tag_id: "tag-x" }), f({ tagId: "tag-y" }))).toBe(
			false,
		);
	});

	it("matches interval exactly", () => {
		expect(
			matchesRecurringFilters(rec({ id: "1", interval: "monthly" }), f({ interval: "monthly" })),
		).toBe(true);
		expect(
			matchesRecurringFilters(rec({ id: "1", interval: "monthly" }), f({ interval: "weekly" })),
		).toBe(false);
	});
});
