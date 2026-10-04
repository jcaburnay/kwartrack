import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EditRecurringModal } from "../components/recurring/EditRecurringModal";
import type { Account } from "../utils/accountBalances";
import type { Recurring } from "../utils/recurringFilters";

const recurring: Recurring = {
	id: "interest",
	user_id: "user",
	service: "Renamed interest",
	type: "income",
	amount_centavos: 59178,
	tag_id: "tag",
	to_account_id: "td",
	from_account_id: null,
	fee_centavos: null,
	description: null,
	interval: "monthly",
	first_occurrence_date: "2026-10-01",
	next_occurrence_at: "2026-10-01T00:00:00Z",
	remaining_occurrences: null,
	is_completed: false,
	is_paused: false,
	completed_at: null,
	created_at: "",
	updated_at: "",
};
const account: Account = {
	id: "td",
	user_id: "user",
	name: "Deposit",
	type: "time-deposit",
	group_id: null,
	credit_limit_centavos: null,
	principal_centavos: 15000000,
	interest_rate_bps: 600,
	maturity_date: "2027-03-01",
	interest_posting_interval: "monthly",
	interest_recurring_id: "interest",
	is_matured: false,
	initial_balance_centavos: 15000000,
	balance_centavos: 15000000,
	is_archived: false,
	created_at: "",
	updated_at: "",
};
function show(row = recurring) {
	render(
		<EditRecurringModal
			recurring={row}
			accounts={[account]}
			groups={[]}
			tags={[]}
			createTag={vi.fn(async () => null)}
			updateRecurring={vi.fn(async () => ({ error: null }))}
			onSaved={vi.fn()}
			onCancel={vi.fn()}
		/>,
	);
}
it("shows linked monthly interest as a read-only estimate with an explanation", () => {
	show();
	expect(screen.getByRole("spinbutton", { name: /amount/i })).toHaveAttribute("readonly");
	expect(screen.getByText(/calculated from the time deposit/i)).toBeInTheDocument();
});
it("keeps independent income to the same deposit editable", () => {
	show({ ...recurring, id: "other" });
	expect(screen.getByRole("spinbutton", { name: /amount/i })).not.toHaveAttribute("readonly");
});
