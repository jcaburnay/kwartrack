import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsTable } from "../components/accounts/AccountsTable";
import type { Account, AccountGroup } from "../utils/accountBalances";
import type { Recurring } from "../utils/recurringFilters";

const ts = "2026-04-24T00:00:00Z";
const baseAccount: Omit<
	Account,
	"id" | "name" | "type" | "balance_centavos" | "initial_balance_centavos"
> = {
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
	created_at: ts,
	updated_at: ts,
};

function mk(p: Partial<Account> & Pick<Account, "name" | "type">): Account {
	return {
		id: p.name,
		initial_balance_centavos: p.balance_centavos ?? 0,
		balance_centavos: p.balance_centavos ?? 0,
		...baseAccount,
		...p,
	};
}

const groups: AccountGroup[] = [
	{ id: "g1", user_id: "u1", name: "Maya", created_at: ts, updated_at: ts },
];

describe("AccountsTable", () => {
	it("shows empty state when no visible accounts", () => {
		render(
			<AccountsTable
				accounts={[]}
				groups={[]}
				recurrings={[]}
				selectedAccountId={null}
				selectedGroupId={null}
				onSelectAccount={() => {}}
				onSelectGroup={() => {}}
				onEdit={() => {}}
				onChanged={() => {}}
				showArchived={false}
			/>,
		);
		expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument();
	});

	it("renders group header with rollup and member rows", () => {
		const accounts: Account[] = [
			mk({ name: "Pocket", type: "cash", balance_centavos: 100_00 }),
			mk({ name: "Maya Wallet", type: "e-wallet", group_id: "g1", balance_centavos: 500_00 }),
			mk({ name: "Maya Goal", type: "savings", group_id: "g1", balance_centavos: 1_000_00 }),
		];
		render(
			<AccountsTable
				accounts={accounts}
				groups={groups}
				recurrings={[]}
				selectedAccountId={null}
				selectedGroupId={null}
				onSelectAccount={() => {}}
				onSelectGroup={() => {}}
				onEdit={() => {}}
				onChanged={() => {}}
				showArchived={false}
			/>,
		);
		const headerCell = screen.getByText("Maya");
		const row = headerCell.closest("tr");
		if (!row) throw new Error("no row for Maya header");
		expect(within(row).getByText(/1,500\.00/)).toBeInTheDocument(); // 500 + 1000
		expect(screen.getByText("Maya Wallet")).toBeInTheDocument();
		expect(screen.getByText("Maya Goal")).toBeInTheDocument();
	});

	it("hides archived unless showArchived is true", () => {
		const accounts: Account[] = [
			mk({ name: "Cash", type: "cash" }),
			mk({ name: "Old", type: "cash", is_archived: true }),
		];
		const { rerender } = render(
			<AccountsTable
				accounts={accounts}
				groups={[]}
				recurrings={[]}
				selectedAccountId={null}
				selectedGroupId={null}
				onSelectAccount={() => {}}
				onSelectGroup={() => {}}
				onEdit={() => {}}
				onChanged={() => {}}
				showArchived={false}
			/>,
		);
		expect(screen.queryByText("Old")).not.toBeInTheDocument();
		rerender(
			<AccountsTable
				accounts={accounts}
				groups={[]}
				recurrings={[]}
				selectedAccountId={null}
				selectedGroupId={null}
				onSelectAccount={() => {}}
				onSelectGroup={() => {}}
				onEdit={() => {}}
				onChanged={() => {}}
				showArchived={true}
			/>,
		);
		expect(screen.getByText("Old")).toBeInTheDocument();
	});

	it("renders compact utilization bar(s) on credit rows", () => {
		const card = mk({
			name: "BPI",
			type: "credit",
			balance_centavos: 200_00,
			credit_limit_centavos: 1000_00,
			installment_limit_centavos: 500_00,
		});
		const card2 = mk({
			name: "BDO",
			type: "credit",
			balance_centavos: 100_00,
			credit_limit_centavos: 1000_00,
		});
		const recurrings: Recurring[] = [
			{
				id: "r1",
				user_id: "u1",
				service: "Plan",
				description: null,
				amount_centavos: 50_00,
				type: "expense",
				tag_id: "tag1",
				from_account_id: "BPI",
				to_account_id: null,
				fee_centavos: null,
				interval: "monthly",
				first_occurrence_date: "2026-01-15",
				next_occurrence_at: "2026-05-15T00:00:00Z",
				remaining_occurrences: 4,
				is_paused: false,
				is_completed: false,
				completed_at: null,
				created_at: ts,
				updated_at: ts,
			},
		];
		render(
			<AccountsTable
				accounts={[card, card2]}
				groups={[]}
				recurrings={recurrings}
				selectedAccountId={null}
				selectedGroupId={null}
				onSelectAccount={() => {}}
				onSelectGroup={() => {}}
				onEdit={() => {}}
				onChanged={() => {}}
				showArchived={false}
			/>,
		);
		// BPI has both pools → two bars; BDO has only regular → one bar.
		const bpiRow = screen.getByText("BPI").closest("tr");
		const bdoRow = screen.getByText("BDO").closest("tr");
		if (!bpiRow || !bdoRow) throw new Error("missing rows");
		expect(within(bpiRow).getAllByRole("progressbar")).toHaveLength(2);
		expect(within(bdoRow).getAllByRole("progressbar")).toHaveLength(1);
	});

	it("selecting a row fires onSelectAccount", async () => {
		const user = (await import("@testing-library/user-event")).default;
		const onSelectAccount = vi.fn();
		const accounts: Account[] = [mk({ name: "Pocket", type: "cash", balance_centavos: 100 })];
		render(
			<AccountsTable
				accounts={accounts}
				groups={[]}
				recurrings={[]}
				selectedAccountId={null}
				selectedGroupId={null}
				onSelectAccount={onSelectAccount}
				onSelectGroup={() => {}}
				onEdit={() => {}}
				onChanged={() => {}}
				showArchived={false}
			/>,
		);
		await user.click(screen.getByText("Pocket"));
		expect(onSelectAccount).toHaveBeenCalledWith("Pocket");
	});
});
