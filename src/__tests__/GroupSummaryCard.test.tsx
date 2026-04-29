import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupSummaryCard } from "../components/strips/GroupSummaryCard";
import type { Account, AccountGroup } from "../utils/accountBalances";

const ts = "2026-04-24T00:00:00Z";

const group: AccountGroup = {
	id: "g1",
	user_id: "u1",
	name: "Credit Cards",
	created_at: ts,
	updated_at: ts,
};

const baseAccount = {
	user_id: "u1",
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
} as const;

function mk(p: Pick<Account, "id" | "name" | "type" | "balance_centavos">): Account {
	return {
		group_id: "g1",
		initial_balance_centavos: p.balance_centavos,
		...baseAccount,
		...p,
	};
}

describe("GroupSummaryCard", () => {
	it("renders group name, rollup, member count, and member rows", () => {
		const accounts: Account[] = [
			mk({ id: "a1", name: "BPI Card", type: "credit", balance_centavos: 7_200_00 }),
			mk({ id: "a2", name: "UnionBank", type: "credit", balance_centavos: 5_000_00 }),
		];
		render(<GroupSummaryCard group={group} accounts={accounts} onClear={() => {}} />);
		expect(screen.getByText("Credit Cards")).toBeInTheDocument();
		expect(screen.getByText("2 accounts")).toBeInTheDocument();
		expect(screen.getByText("BPI Card")).toBeInTheDocument();
		expect(screen.getByText("UnionBank")).toBeInTheDocument();
	});

	it("uses singular 'account' when there is one member", () => {
		const accounts: Account[] = [
			mk({ id: "a1", name: "BPI Card", type: "credit", balance_centavos: 7_200_00 }),
		];
		render(<GroupSummaryCard group={group} accounts={accounts} onClear={() => {}} />);
		expect(screen.getByText("1 account")).toBeInTheDocument();
	});

	it("invokes onClear when the clear button is clicked", () => {
		const onClear = vi.fn();
		render(<GroupSummaryCard group={group} accounts={[]} onClear={onClear} />);
		fireEvent.click(screen.getByRole("button", { name: /clear group selection/i }));
		expect(onClear).toHaveBeenCalledOnce();
	});

	it("renders rollup with text-error when negative", () => {
		const accounts: Account[] = [
			mk({ id: "a1", name: "BPI Card", type: "credit", balance_centavos: 7_200_00 }),
		];
		const { container } = render(
			<GroupSummaryCard group={group} accounts={accounts} onClear={() => {}} />,
		);
		const rollup = container.querySelector('[data-testid="group-rollup"]');
		expect(rollup?.className).toMatch(/text-error/);
	});
});
