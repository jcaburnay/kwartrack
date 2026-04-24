import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsTable } from "../components/accounts/AccountsTable";
import type { Account, AccountGroup } from "../utils/accountBalances";

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

	it("selecting a row fires onSelectAccount", async () => {
		const user = (await import("@testing-library/user-event")).default;
		const onSelectAccount = vi.fn();
		const accounts: Account[] = [mk({ name: "Pocket", type: "cash", balance_centavos: 100 })];
		render(
			<AccountsTable
				accounts={accounts}
				groups={[]}
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
