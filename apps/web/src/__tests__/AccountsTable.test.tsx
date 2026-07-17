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
	principal_centavos: null,
	interest_rate_bps: null,
	maturity_date: null,
	interest_posting_interval: null,
	interest_recurring_id: null,
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

	it("renders a compact utilization bar on credit rows", () => {
		const card = mk({
			name: "BPI",
			type: "credit",
			balance_centavos: 200_00,
			credit_limit_centavos: 1000_00,
		});
		render(
			<AccountsTable
				accounts={[card]}
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
		const bpiRow = screen.getByText("BPI").closest("tr");
		if (!bpiRow) throw new Error("missing row");
		expect(within(bpiRow).getAllByRole("progressbar")).toHaveLength(1);
	});

	it("renders a Matured badge on a matured time-deposit row", () => {
		const td = mk({
			name: "BPI TD",
			type: "time-deposit",
			balance_centavos: 100_500_00,
			initial_balance_centavos: 100_000_00,
			principal_centavos: 100_000_00,
			interest_rate_bps: 600,
			maturity_date: "2026-04-01",
			interest_posting_interval: "monthly",
			is_matured: true,
		});
		const liveTd = mk({
			name: "Maya TD",
			type: "time-deposit",
			balance_centavos: 50_000_00,
			initial_balance_centavos: 50_000_00,
			principal_centavos: 50_000_00,
			interest_rate_bps: 500,
			maturity_date: "2027-04-01",
			interest_posting_interval: "monthly",
			is_matured: false,
		});
		render(
			<AccountsTable
				accounts={[td, liveTd]}
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
		const matured = screen.getByText("BPI TD").closest("tr");
		const live = screen.getByText("Maya TD").closest("tr");
		if (!matured || !live) throw new Error("missing rows");
		expect(within(matured).getByText(/^matured$/i)).toBeInTheDocument();
		expect(within(live).queryByText(/^matured$/i)).not.toBeInTheDocument();
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

describe("AccountsTable typeFilter", () => {
	it("renders only credit accounts when typeFilter is 'credit'", () => {
		const accounts: Account[] = [
			mk({ name: "Wallet", type: "cash", balance_centavos: 100_00 }),
			mk({ name: "Card", type: "credit", balance_centavos: 50_00 }),
		];
		render(
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
				typeFilter="credit"
			/>,
		);
		expect(screen.queryByText("Wallet")).not.toBeInTheDocument();
		expect(screen.getByText("Card")).toBeInTheDocument();
	});

	it("renders all accounts when typeFilter is null/undefined", () => {
		const accounts: Account[] = [
			mk({ name: "Wallet", type: "cash", balance_centavos: 100_00 }),
			mk({ name: "Card", type: "credit", balance_centavos: 50_00 }),
		];
		render(
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
		expect(screen.getByText("Wallet")).toBeInTheDocument();
		expect(screen.getByText("Card")).toBeInTheDocument();
	});
});
