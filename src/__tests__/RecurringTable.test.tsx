import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecurringTable } from "../components/recurring/RecurringTable";
import type { Tag } from "../hooks/useTags";
import type { Account } from "../utils/accountBalances";
import type { Recurring } from "../utils/recurringFilters";

const ts = "2026-04-26T00:00:00Z";

function rec(p: Partial<Recurring> & Pick<Recurring, "id">): Recurring {
	return {
		amount_centavos: 14_900,
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

function mkAccount(id: string, name: string): Account {
	return {
		id,
		user_id: "u1",
		name,
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
	};
}

const accounts: Account[] = [mkAccount("cash", "BPI Card"), mkAccount("savings", "BDO Savings")];

const tags: Tag[] = [
	{ id: "music", user_id: "u1", name: "music", type: "expense", is_system: false, created_at: ts },
];

const noop = vi.fn(async () => ({ error: null }));

function renderTable(recurrings: Recurring[]) {
	return render(
		<RecurringTable
			recurrings={recurrings}
			accounts={accounts}
			tags={tags}
			onEdit={vi.fn()}
			onTogglePaused={noop}
			onDelete={noop}
		/>,
	);
}

describe("RecurringTable (6-column layout)", () => {
	it("shows the empty state when no recurrings", () => {
		renderTable([]);
		expect(screen.getByText(/No recurrings yet/i)).toBeInTheDocument();
	});

	it("renders 6 column headers", () => {
		renderTable([rec({ id: "1" })]);
		const headers = screen.getAllByRole("columnheader").map((th) => th.textContent?.trim() ?? "");
		expect(headers).toEqual(["Service", "Amount", "Tag", "Account", "Schedule", ""]);
	});

	it("renders an active expense without a status glyph and without dim", () => {
		renderTable([rec({ id: "1" })]);
		expect(screen.getByText("Spotify")).toBeInTheDocument();
		expect(screen.queryByLabelText("Paused")).toBeNull();
		expect(screen.queryByLabelText("Completed")).toBeNull();
		const row = screen.getByText("Spotify").closest("tr");
		expect(row?.className ?? "").not.toMatch(/opacity-60/);
	});

	it("renders the Pause glyph and dims the row when paused", () => {
		renderTable([rec({ id: "1", is_paused: true })]);
		expect(screen.getByLabelText("Paused")).toBeInTheDocument();
		const row = screen.getByText("Spotify").closest("tr");
		expect(row?.className ?? "").toMatch(/opacity-60/);
	});

	it("renders the Completed glyph and 'Completed' sub-line when completed", () => {
		renderTable([
			rec({
				id: "1",
				is_completed: true,
				completed_at: ts,
				remaining_occurrences: 0,
			}),
		]);
		expect(screen.getByLabelText("Completed")).toBeInTheDocument();
		const row = screen.getByText("Spotify").closest("tr");
		expect(within(row as HTMLElement).getByText("Completed")).toBeInTheDocument();
	});

	it("renders signed amount and no separate Type column for expenses", () => {
		renderTable([rec({ id: "1", amount_centavos: 14_900, type: "expense" })]);
		expect(screen.getByText(/-₱149/)).toBeInTheDocument();
		expect(screen.queryByText(/^expense$/)).toBeNull();
	});

	it("renders income amount with a + sign", () => {
		renderTable([
			rec({
				id: "1",
				type: "income",
				from_account_id: null,
				to_account_id: "savings",
				amount_centavos: 45_000_00,
			}),
		]);
		expect(screen.getByText(/\+₱45,000/)).toBeInTheDocument();
	});

	it("renders the Account cell as source for expense, dest for income, arrow for transfer", () => {
		renderTable([
			rec({ id: "exp", from_account_id: "cash", to_account_id: null, type: "expense" }),
			rec({
				id: "inc",
				type: "income",
				from_account_id: null,
				to_account_id: "savings",
			}),
			rec({
				id: "xfer",
				type: "transfer",
				from_account_id: "cash",
				to_account_id: "savings",
				tag_id: null,
			}),
		]);
		const rows = screen.getAllByRole("row").slice(1); // drop header row
		expect(within(rows[0]).getByText("BPI Card")).toBeInTheDocument();
		expect(within(rows[1]).getByText("BDO Savings")).toBeInTheDocument();
		expect(within(rows[2]).getByText(/BPI Card → BDO Savings/)).toBeInTheDocument();
	});

	it("renders the schedule sub-line as 'monthly' for plain monthly", () => {
		renderTable([rec({ id: "1", interval: "monthly", remaining_occurrences: null })]);
		expect(screen.getByText("monthly")).toBeInTheDocument();
	});

	it("renders the schedule sub-line as 'monthly · 5 left' for installments", () => {
		renderTable([rec({ id: "1", interval: "monthly", remaining_occurrences: 5 })]);
		expect(screen.getByText(/monthly · 5 left/)).toBeInTheDocument();
	});

	it("renders fee on a sub-line for transfers with a fee", () => {
		renderTable([
			rec({
				id: "xfer",
				type: "transfer",
				from_account_id: "cash",
				to_account_id: "savings",
				tag_id: null,
				amount_centavos: 15_000_00,
				fee_centavos: 1_500,
			}),
		]);
		expect(screen.getByText(/\+₱15.*fee/)).toBeInTheDocument();
	});
});
