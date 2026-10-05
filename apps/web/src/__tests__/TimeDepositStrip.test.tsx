import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { TimeDepositStrip } from "../components/strips/TimeDepositStrip";
import type { Account } from "../utils/accountBalances";

const { query, confirm } = vi.hoisted(() => ({
	query: vi.fn(),
	confirm: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
	supabase: {
		from: () => ({
			select: () => ({
				eq: (_column: string, accountId: string) => ({ maybeSingle: () => query(accountId) }),
			}),
		}),
		rpc: confirm,
	},
}));

const account: Account = {
	id: "td-1",
	user_id: "user",
	name: "Deposit",
	type: "time-deposit",
	group_id: null,
	credit_limit_centavos: null,
	principal_centavos: 15_000_000,
	interest_rate_bps: 600,
	maturity_date: "2027-03-01",
	interest_posting_interval: "monthly",
	interest_recurring_id: "interest",
	is_matured: false,
	initial_balance_centavos: 15_000_000,
	balance_centavos: 15_000_000,
	is_archived: false,
	created_at: "2026-09-01T00:00:00Z",
	updated_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
	query.mockReset();
	confirm.mockReset();
	query.mockResolvedValue({
		data: { needs_reconciliation: true, reconciliation_cutover: "2026-10-01" },
		error: null,
	});
	confirm.mockResolvedValue({ error: null });
});

it("explains the cutover review and clears the notice after confirmation", async () => {
	render(<TimeDepositStrip account={account} />);
	expect(screen.getByRole("status")).toHaveTextContent(/checking interest history/i);
	expect(await screen.findByText(/pre-cutover interest may need review/i)).toBeInTheDocument();
	expect(screen.getByText(/normal income transaction/i)).toBeInTheDocument();
	await userEvent.setup().click(screen.getByRole("button", { name: "Mark reviewed" }));
	expect(confirm).toHaveBeenCalledWith("td_confirm_interest_reconciliation", {
		p_account_id: "td-1",
	});
	await waitFor(() => {
		expect(screen.queryByText(/pre-cutover interest may need review/i)).not.toBeInTheDocument();
	});
});

it("shows a retryable error when reconciliation status cannot be loaded", async () => {
	query.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
	render(<TimeDepositStrip account={account} />);
	expect(await screen.findByText(/could not check interest history/i)).toBeInTheDocument();
	await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
	expect(await screen.findByText(/pre-cutover interest may need review/i)).toBeInTheDocument();
});

it("keeps the notice visible when confirmation fails", async () => {
	confirm.mockResolvedValueOnce({ error: { message: "Offline" } });
	render(<TimeDepositStrip account={account} />);
	await screen.findByText(/pre-cutover interest may need review/i);
	await userEvent.setup().click(screen.getByRole("button", { name: "Mark reviewed" }));
	expect(await screen.findByRole("alert")).toHaveTextContent(/could not mark reviewed: Offline/i);
	expect(screen.getByText(/pre-cutover interest may need review/i)).toBeInTheDocument();
});

it("does not request monthly reconciliation for other cadences", () => {
	render(<TimeDepositStrip account={{ ...account, interest_posting_interval: "at-maturity" }} />);
	expect(query).not.toHaveBeenCalled();
	expect(screen.queryByText(/checking interest history/i)).not.toBeInTheDocument();
});

it("does not show stale status after switching deposits", async () => {
	let resolveFirst: (result: unknown) => void = () => {};
	query.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				resolveFirst = resolve;
			}),
	);
	query.mockResolvedValueOnce({
		data: { needs_reconciliation: false, reconciliation_cutover: null },
		error: null,
	});
	const view = render(<TimeDepositStrip account={account} />);
	view.rerender(<TimeDepositStrip account={{ ...account, id: "td-2" }} />);
	resolveFirst({
		data: { needs_reconciliation: true, reconciliation_cutover: "2026-10-01" },
		error: null,
	});
	await waitFor(() => expect(query).toHaveBeenCalledWith("td-2"));
	expect(screen.queryByText(/pre-cutover interest may need review/i)).not.toBeInTheDocument();
});
