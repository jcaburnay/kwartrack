import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { RecurringPanel } from "../components/panels/RecurringPanel";
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

let accountsState = {
	accounts: [] as Account[],
	isLoading: true,
	error: null as string | null,
	refetch: vi.fn(async () => {}),
};
vi.mock("../hooks/useAccounts", () => ({ useAccounts: () => accountsState }));
vi.mock("../hooks/useAccountGroups", () => ({ useAccountGroups: () => ({ groups: [] }) }));
vi.mock("../hooks/useTags", () => ({ useTags: () => ({ tags: [], createInline: vi.fn() }) }));
const recurringRows = [recurring];
vi.mock("../hooks/useRecurrings", () => ({
	useRecurrings: () => ({
		recurrings: recurringRows,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
		createRecurring: vi.fn(),
		updateRecurring: vi.fn(),
		deleteRecurring: vi.fn(),
		togglePaused: vi.fn(),
	}),
}));
beforeEach(() => {
	accountsState = { accounts: [], isLoading: true, error: null, refetch: vi.fn(async () => {}) };
});
it("waits for accounts before opening a requested recurring edit", () => {
	const consumed = vi.fn();
	const props = {
		pendingModal: { kind: "edit" as const, id: "interest" },
		onPendingModalConsumed: consumed,
	};
	const view = render(<RecurringPanel {...props} />);
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(consumed).not.toHaveBeenCalled();
	accountsState = { ...accountsState, accounts: [account], isLoading: false };
	view.rerender(<RecurringPanel {...props} />);
	expect(screen.getByRole("dialog")).toBeInTheDocument();
	expect(screen.getByRole("spinbutton", { name: /amount/i })).toHaveAttribute("readonly");
	expect(consumed).toHaveBeenCalledOnce();
});
it("blocks row editing when account loading fails and lets the user retry", async () => {
	accountsState = { ...accountsState, isLoading: false, error: "Connection failed" };
	render(<RecurringPanel pendingModal={null} onPendingModalConsumed={vi.fn()} />);
	const user = userEvent.setup();
	await user.click(screen.getAllByRole("button", { name: "Row actions" })[0]);
	await user.click(screen.getByRole("button", { name: "Edit" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(screen.getByText(/accounts could not be loaded/i)).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Retry accounts" }));
	expect(accountsState.refetch).toHaveBeenCalledOnce();
});
it("waits for accounts after a row edit request and opens with protected controls", async () => {
	const props = { pendingModal: null, onPendingModalConsumed: vi.fn() };
	const view = render(<RecurringPanel {...props} />);
	const user = userEvent.setup();
	await user.click(screen.getAllByRole("button", { name: "Row actions" })[0]);
	await user.click(screen.getByRole("button", { name: "Edit" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(screen.getByRole("status")).toHaveTextContent(/Loading accounts/);
	accountsState = { ...accountsState, accounts: [account], isLoading: false };
	view.rerender(<RecurringPanel {...props} />);
	expect(screen.getByRole("dialog")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Expense" })).toBeDisabled();
});
