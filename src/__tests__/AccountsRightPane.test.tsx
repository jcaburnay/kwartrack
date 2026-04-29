import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountsRightPane } from "../components/accounts/AccountsRightPane";
import type { Account, AccountGroup } from "../utils/accountBalances";

const ts = "2026-04-24T00:00:00Z";

const group: AccountGroup = {
	id: "g1",
	user_id: "u1",
	name: "Cash",
	created_at: ts,
	updated_at: ts,
};

const account: Account = {
	id: "a1",
	user_id: "u1",
	name: "BPI Savings",
	type: "savings",
	balance_centavos: 32_150_00,
	initial_balance_centavos: 32_150_00,
	group_id: null,
	is_archived: false,
	credit_limit_centavos: null,
	installment_limit_centavos: null,
	principal_centavos: null,
	interest_rate_bps: null,
	maturity_date: null,
	interest_posting_interval: null,
	interest_recurring_id: null,
	is_matured: false,
	created_at: ts,
	updated_at: ts,
};

describe("AccountsRightPane", () => {
	it("shows placeholder copy when nothing is selected", () => {
		render(
			<AccountsRightPane
				selection={{ kind: "none" }}
				accounts={[]}
				transactions={[]}
				recurrings={[]}
				timezone="Asia/Manila"
				onClear={() => {}}
				onPayThisCard={() => {}}
				onWithdrawMatured={() => {}}
			/>,
		);
		expect(screen.getByText(/select an account or group/i)).toBeInTheDocument();
	});

	it("renders the account detail strip when an account is selected", () => {
		render(
			<AccountsRightPane
				selection={{ kind: "account", account }}
				accounts={[account]}
				transactions={[]}
				recurrings={[]}
				timezone="Asia/Manila"
				onClear={() => {}}
				onPayThisCard={() => {}}
				onWithdrawMatured={() => {}}
			/>,
		);
		// AccountDetailStrip renders the name in both its header <strong> and inside
		// SimpleAccountStrip, so use getAllByText to handle multiple nodes.
		expect(screen.getAllByText("BPI Savings").length).toBeGreaterThan(0);
	});

	it("renders the group summary card when a group is selected", () => {
		render(
			<AccountsRightPane
				selection={{ kind: "group", group }}
				accounts={[account]}
				transactions={[]}
				recurrings={[]}
				timezone="Asia/Manila"
				onClear={() => {}}
				onPayThisCard={() => {}}
				onWithdrawMatured={() => {}}
			/>,
		);
		// Group name renders inside the card; case-sensitive match against the source text node.
		expect(screen.getByText("Cash")).toBeInTheDocument();
	});
});
