import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	TransactionForm,
	type TransactionFormValues,
} from "../components/transactions/TransactionForm";
import type { Tag } from "../hooks/useTags";
import type { Account } from "../utils/accountBalances";

// The form is the interesting piece for type-switching; the modal is a thin
// shell around it. Test the form directly to avoid mocking supabase.

const ts = "2026-04-24T00:00:00Z";
const makeAccount = (p: Partial<Account> & Pick<Account, "id" | "name" | "type">): Account => ({
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

const accounts: Account[] = [
	makeAccount({ id: "cash", name: "Cash", type: "cash" }),
	makeAccount({ id: "wallet", name: "Wallet", type: "e-wallet" }),
];

const tags: Tag[] = [
	{ id: "foods", user_id: "u1", name: "foods", type: "expense", is_system: false, created_at: ts },
	{
		id: "salary",
		user_id: "u1",
		name: "monthly-salary",
		type: "income",
		is_system: false,
		created_at: ts,
	},
	{
		id: "txfer-fees",
		user_id: "u1",
		name: "transfer-fees",
		type: "expense",
		is_system: true,
		created_at: ts,
	},
];

const baseDefaults: TransactionFormValues = {
	type: "expense",
	amountPesos: 0,
	tagId: null,
	fromAccountId: null,
	toAccountId: null,
	feePesos: null,
	description: "",
	date: "2026-04-24",
};

describe("TransactionForm type switching", () => {
	it("expense mode shows From, hides To + Fee", () => {
		render(
			<TransactionForm
				mode="create"
				accounts={accounts}
				tags={tags}
				defaults={baseDefaults}
				submitError={null}
				isSubmitting={false}
				createTag={async () => null}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		expect(screen.getByText(/From account/i)).toBeInTheDocument();
		expect(screen.queryByText(/To account/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/^Fee/i)).not.toBeInTheDocument();
	});

	it("switching to transfer reveals To + Fee", async () => {
		const user = userEvent.setup();
		render(
			<TransactionForm
				mode="create"
				accounts={accounts}
				tags={tags}
				defaults={baseDefaults}
				submitError={null}
				isSubmitting={false}
				createTag={async () => null}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		await user.click(screen.getByRole("tab", { name: "Transfer" }));
		expect(screen.getByText(/From account/i)).toBeInTheDocument();
		expect(screen.getByText(/To account/i)).toBeInTheDocument();
		expect(screen.getByText(/^Fee/i)).toBeInTheDocument();
	});

	it("switching to income hides From, reveals To", async () => {
		const user = userEvent.setup();
		render(
			<TransactionForm
				mode="create"
				accounts={accounts}
				tags={tags}
				defaults={baseDefaults}
				submitError={null}
				isSubmitting={false}
				createTag={async () => null}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		await user.click(screen.getByRole("tab", { name: "Income" }));
		expect(screen.queryByText(/From account/i)).not.toBeInTheDocument();
		expect(screen.getByText(/To account/i)).toBeInTheDocument();
	});

	it("tag picker hides system tags and filters by current type", async () => {
		const user = userEvent.setup();
		render(
			<TransactionForm
				mode="create"
				accounts={accounts}
				tags={tags}
				defaults={baseDefaults}
				submitError={null}
				isSubmitting={false}
				createTag={async () => null}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		// Expense mode: only 'foods' (expense) shows; 'monthly-salary' (income) and
		// 'transfer-fees' (system) are hidden.
		expect(screen.getByRole("option", { name: "foods" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "monthly-salary" })).not.toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "transfer-fees" })).not.toBeInTheDocument();

		// Switch to income.
		await user.click(screen.getByRole("tab", { name: "Income" }));
		expect(screen.getByRole("option", { name: "monthly-salary" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "foods" })).not.toBeInTheDocument();
	});
});
