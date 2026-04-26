import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecurringTable } from "../components/recurring/RecurringTable";
import type { Tag } from "../hooks/useTags";
import type { Account } from "../utils/accountBalances";
import type { Recurring } from "../utils/recurringFilters";

const ts = "2026-04-26T00:00:00Z";

function rec(p: Partial<Recurring> & Pick<Recurring, "id">): Recurring {
	return {
		amount_centavos: 27_900,
		completed_at: null,
		created_at: ts,
		description: null,
		fee_centavos: null,
		first_occurrence_date: "2026-04-26",
		from_account_id: "cash",
		interval: "monthly",
		is_completed: false,
		is_paused: false,
		next_occurrence_at: "2026-04-26T16:00:00Z",
		remaining_occurrences: null,
		service: "Spotify",
		tag_id: "foods",
		to_account_id: null,
		type: "expense",
		updated_at: ts,
		user_id: "u1",
		...p,
	};
}

const accounts: Account[] = [
	{
		id: "cash",
		user_id: "u1",
		name: "Cash",
		type: "cash",
		group_id: null,
		credit_limit_centavos: null,
		installment_limit_centavos: null,
		principal_centavos: null,
		interest_rate_bps: null,
		maturity_date: null,
		interest_posting_interval: null,
		interest_recurring_id: null,
		is_matured: false,
		initial_balance_centavos: 0,
		balance_centavos: 0,
		is_archived: false,
		created_at: ts,
		updated_at: ts,
	},
];

const tags: Tag[] = [
	{ id: "foods", user_id: "u1", name: "foods", type: "expense", is_system: false, created_at: ts },
];

const noop = vi.fn(async () => ({ error: null }));

describe("RecurringTable", () => {
	it("shows the empty state when no recurrings", () => {
		render(
			<RecurringTable
				recurrings={[]}
				accounts={accounts}
				tags={tags}
				onEdit={vi.fn()}
				onTogglePaused={noop}
				onDelete={noop}
			/>,
		);
		expect(screen.getByText(/No recurrings yet/)).toBeInTheDocument();
	});

	it("renders an active row without status icon", () => {
		render(
			<RecurringTable
				recurrings={[rec({ id: "1" })]}
				accounts={accounts}
				tags={tags}
				onEdit={vi.fn()}
				onTogglePaused={noop}
				onDelete={noop}
			/>,
		);
		expect(screen.getByText("Spotify")).toBeInTheDocument();
		expect(screen.queryByLabelText("Paused")).toBeNull();
		expect(screen.queryByLabelText("Completed")).toBeNull();
	});

	it("shows the Paused icon for paused recurrings", () => {
		render(
			<RecurringTable
				recurrings={[rec({ id: "1", is_paused: true })]}
				accounts={accounts}
				tags={tags}
				onEdit={vi.fn()}
				onTogglePaused={noop}
				onDelete={noop}
			/>,
		);
		expect(screen.getByLabelText("Paused")).toBeInTheDocument();
	});

	it("shows the Completed icon for completed recurrings", () => {
		render(
			<RecurringTable
				recurrings={[
					rec({
						id: "1",
						is_completed: true,
						completed_at: ts,
						remaining_occurrences: 0,
					}),
				]}
				accounts={accounts}
				tags={tags}
				onEdit={vi.fn()}
				onTogglePaused={noop}
				onDelete={noop}
			/>,
		);
		expect(screen.getByLabelText("Completed")).toBeInTheDocument();
	});
});
