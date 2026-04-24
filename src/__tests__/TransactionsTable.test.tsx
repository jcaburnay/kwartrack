import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TransactionsTable } from "../components/transactions/TransactionsTable";
import type { Tag } from "../hooks/useTags";
import type { Account } from "../utils/accountBalances";
import type { Transaction } from "../utils/transactionFilters";

const ts = "2026-04-24T00:00:00Z";
const acc = (p: Partial<Account> & Pick<Account, "id" | "name" | "type">): Account => ({
	user_id: "u1",
	group_id: null,
	is_archived: false,
	credit_limit_centavos: null,
	installment_limit_centavos: null,
	principal_centavos: null,
	interest_rate_bps: null,
	maturity_date: null,
	interest_posting_interval: null,
	is_matured: false,
	initial_balance_centavos: 0,
	balance_centavos: 0,
	created_at: ts,
	updated_at: ts,
	...p,
});

const tx = (
	p: Partial<Transaction> & Pick<Transaction, "id" | "type" | "date" | "amount_centavos">,
): Transaction => ({
	user_id: "u1",
	created_at: ts,
	updated_at: ts,
	description: null,
	fee_centavos: null,
	from_account_id: null,
	parent_transaction_id: null,
	tag_id: null,
	to_account_id: null,
	...p,
});

const accounts: Account[] = [
	acc({ id: "cash", name: "Cash", type: "cash" }),
	acc({ id: "wallet", name: "Wallet", type: "e-wallet" }),
];
const tags: Tag[] = [
	{ id: "foods", user_id: "u1", name: "foods", type: "expense", is_system: false, created_at: ts },
];

describe("TransactionsTable", () => {
	it("renders empty state when empty", () => {
		render(
			<TransactionsTable
				transactions={[]}
				accounts={accounts}
				groups={[]}
				tags={tags}
				onEdit={() => {}}
				onChanged={() => {}}
				emptyCopy="Nothing here."
			/>,
		);
		expect(screen.getByText("Nothing here.")).toBeInTheDocument();
	});

	it("renders rows sorted by date desc by default", () => {
		const rows: Transaction[] = [
			tx({
				id: "a",
				type: "expense",
				date: "2026-04-01",
				amount_centavos: 50_00,
				from_account_id: "cash",
				tag_id: "foods",
			}),
			tx({
				id: "b",
				type: "expense",
				date: "2026-04-10",
				amount_centavos: 30_00,
				from_account_id: "cash",
				tag_id: "foods",
			}),
		];
		render(
			<TransactionsTable
				transactions={rows}
				accounts={accounts}
				groups={[]}
				tags={tags}
				onEdit={() => {}}
				onChanged={() => {}}
				emptyCopy="empty"
			/>,
		);
		const bodyRows = screen.getAllByRole("row").slice(1); // skip header
		expect(bodyRows[0]).toHaveTextContent("April 10");
		expect(bodyRows[1]).toHaveTextContent("April 1");
	});

	it("clicking amount header toggles sort direction", async () => {
		const user = userEvent.setup();
		const rows: Transaction[] = [
			tx({
				id: "a",
				type: "expense",
				date: "2026-04-10",
				amount_centavos: 100_00,
				from_account_id: "cash",
				tag_id: "foods",
			}),
			tx({
				id: "b",
				type: "expense",
				date: "2026-04-10",
				amount_centavos: 200_00,
				from_account_id: "cash",
				tag_id: "foods",
			}),
		];
		render(
			<TransactionsTable
				transactions={rows}
				accounts={accounts}
				groups={[]}
				tags={tags}
				onEdit={() => {}}
				onChanged={() => {}}
				emptyCopy="empty"
			/>,
		);
		await user.click(screen.getByText(/^Amount/));
		const bodyRows = screen.getAllByRole("row").slice(1);
		expect(bodyRows[0]).toHaveTextContent("200.00");
		// Click again for ascending.
		await user.click(screen.getByText(/^Amount/));
		const asc = screen.getAllByRole("row").slice(1);
		expect(asc[0]).toHaveTextContent("100.00");
	});

	it("shows fee for transfer rows, em-dash otherwise", () => {
		const rows: Transaction[] = [
			tx({
				id: "x",
				type: "transfer",
				date: "2026-04-10",
				amount_centavos: 500_00,
				fee_centavos: 10_00,
				from_account_id: "cash",
				to_account_id: "wallet",
			}),
		];
		render(
			<TransactionsTable
				transactions={rows}
				accounts={accounts}
				groups={[]}
				tags={tags}
				onEdit={() => {}}
				onChanged={() => {}}
				emptyCopy="empty"
			/>,
		);
		const row = screen.getAllByRole("row")[1];
		expect(row).toHaveTextContent("₱10.00");
	});
});
