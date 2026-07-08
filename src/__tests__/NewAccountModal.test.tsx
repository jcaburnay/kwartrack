import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewAccountModal } from "../components/accounts/NewAccountModal";

const insert = vi.fn();
const savingsAccount = {
	id: "savings-1",
	user_id: "u1",
	name: "BPI Savings",
	type: "savings",
	group_id: null,
	is_archived: false,
	credit_limit_centavos: null,
	principal_centavos: null,
	interest_rate_bps: null,
	maturity_date: null,
	interest_posting_interval: null,
	interest_recurring_id: null,
	is_matured: false,
	initial_balance_centavos: 100_000_00,
	balance_centavos: 100_000_00,
	created_at: "2026-07-08T00:00:00Z",
	updated_at: "2026-07-08T00:00:00Z",
} as const;

vi.mock("../lib/supabase", () => ({
	supabase: {
		from: () => ({
			insert: (...args: unknown[]) => {
				insert(...args);
				return Promise.resolve({ error: null });
			},
			select: () => ({
				single: () => Promise.resolve({ data: { id: "g-new" }, error: null }),
			}),
		}),
	},
}));

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({ user: { id: "u1" } }),
}));

describe("NewAccountModal — type picker", () => {
	beforeEach(() => {
		insert.mockReset();
	});

	it("shows all five account types as options", () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		expect(screen.getByRole("button", { name: /^cash/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /e-wallet/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^savings/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^credit card/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /time deposit/i })).toBeInTheDocument();
	});

	it("reveals the cash form after picking Cash", async () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /^cash/i }));
		expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/initial balance/i)).toBeInTheDocument();
	});

	it("reveals credit-specific fields after picking Credit card", async () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /^credit card/i }));
		expect(screen.getByLabelText(/credit limit/i)).toBeInTheDocument();
	});

	it("reveals time-deposit fields after picking Time deposit", async () => {
		render(
			<NewAccountModal
				accounts={[savingsAccount]}
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /time deposit/i }));
		expect(screen.getByLabelText(/principal/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/maturity date/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/interest posts/i)).toBeInTheDocument();
	});

	it("lets a new time deposit be funded from an existing account", async () => {
		render(
			<NewAccountModal
				accounts={[savingsAccount]}
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /time deposit/i }));

		const fundingSource = screen.getByLabelText(/funding source/i);
		const principal = screen.getByLabelText(/principal/i);
		expect(fundingSource.compareDocumentPosition(principal)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(screen.getByRole("option", { name: /select account/i })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: /bpi savings/i })).toBeInTheDocument();
	});
});
