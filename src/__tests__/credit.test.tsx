import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPesos } from "../utils/currency";

// ============================================================================
// Fixture data — matches the Phase 6 schema (added in Plan 02)
// ============================================================================

const creditSubAccount = {
	id: 1n,
	accountId: 1n,
	name: "RCBC/Credit",
	balanceCentavos: 620000n, // P6,200 outstanding
	isDefault: false,
	createdAt: { microsSinceUnixEpoch: 0n },
	subAccountType: "credit",
	creditLimitCentavos: 12000000n, // P120,000 limit
};

const walletSubAccount = {
	id: 2n,
	accountId: 1n,
	name: "RCBC/Savings",
	balanceCentavos: 5000000n,
	isDefault: false,
	createdAt: { microsSinceUnixEpoch: 0n },
	subAccountType: "wallet",
	creditLimitCentavos: 0n,
};

const mockAccount = {
	id: 1n,
	name: "RCBC",
	isStandalone: false,
	ownerIdentity: null,
};

// ============================================================================
// formatPesos sanity check — verifies the format used in credit display
// ============================================================================

describe("formatPesos credit amounts", () => {
	it("formats 620000 centavos as P6,200.00", () => {
		expect(formatPesos(620000n)).toBe("P6,200.00");
	});

	it("formats 12000000 centavos as P120,000.00", () => {
		expect(formatPesos(12000000n)).toBe("P120,000.00");
	});
});

// ============================================================================
// CRDT-04: SubAccountCard credit variant
// ============================================================================

describe("SubAccountCard credit variant", () => {
	it("renders available credit and limit for credit partition", async () => {
		const { SubAccountCard } = await import("../components/SubAccountCard");
		render(
			<SubAccountCard
				id={creditSubAccount.id}
				name={creditSubAccount.name}
				balanceCentavos={creditSubAccount.balanceCentavos}
				subAccountType={creditSubAccount.subAccountType}
				creditLimitCentavos={creditSubAccount.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		// Available = 12000000 - 620000 = 11380000 centavos = P113,800.00
		expect(screen.getByText(/P113,800/)).toBeInTheDocument();
		expect(screen.getByText(/P120,000/)).toBeInTheDocument();
	});

	it("shows available percentage for credit partition", async () => {
		const { SubAccountCard } = await import("../components/SubAccountCard");
		render(
			<SubAccountCard
				id={creditSubAccount.id}
				name={creditSubAccount.name}
				balanceCentavos={creditSubAccount.balanceCentavos}
				subAccountType={creditSubAccount.subAccountType}
				creditLimitCentavos={creditSubAccount.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		// 95% available
		expect(screen.getByText(/95% available/)).toBeInTheDocument();
	});

	it("renders Edit option in dropdown for credit partition", async () => {
		const { SubAccountCard } = await import("../components/SubAccountCard");
		render(
			<SubAccountCard
				id={creditSubAccount.id}
				name={creditSubAccount.name}
				balanceCentavos={creditSubAccount.balanceCentavos}
				subAccountType={creditSubAccount.subAccountType}
				creditLimitCentavos={creditSubAccount.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		expect(screen.getByRole("button", { name: /^Edit$/ })).toBeInTheDocument();
	});

	it("renders CREDIT badge for credit partition", async () => {
		const { SubAccountCard } = await import("../components/SubAccountCard");
		render(
			<SubAccountCard
				id={creditSubAccount.id}
				name={creditSubAccount.name}
				balanceCentavos={creditSubAccount.balanceCentavos}
				subAccountType={creditSubAccount.subAccountType}
				creditLimitCentavos={creditSubAccount.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		expect(screen.getByText("CREDIT")).toBeInTheDocument();
	});

	it("renders Pay button for credit partition with non-zero balance", async () => {
		const { SubAccountCard } = await import("../components/SubAccountCard");
		render(
			<SubAccountCard
				id={creditSubAccount.id}
				name={creditSubAccount.name}
				balanceCentavos={creditSubAccount.balanceCentavos}
				subAccountType={creditSubAccount.subAccountType}
				creditLimitCentavos={creditSubAccount.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		expect(screen.getByRole("button", { name: /^Pay$/i })).toBeInTheDocument();
	});

	it("does NOT render CREDIT badge for wallet partition", async () => {
		const { SubAccountCard } = await import("../components/SubAccountCard");
		render(
			<SubAccountCard
				id={walletSubAccount.id}
				name={walletSubAccount.name}
				balanceCentavos={walletSubAccount.balanceCentavos}
				subAccountType={walletSubAccount.subAccountType}
				creditLimitCentavos={walletSubAccount.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
			/>,
		);
		expect(screen.queryByText("CREDIT")).toBeNull();
	});
});

// ============================================================================
// CRDT-01: SubAccountModal credit fields
// ============================================================================

describe("SubAccountModal credit fields", () => {
	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[walletSubAccount], true]);
	});

	it("renders Sub-account type select with Credit option", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		// The modal should render a sub-account type selector
		const typeSelect = screen.getByLabelText(/Sub-account type/i);
		expect(typeSelect).toBeInTheDocument();
		// Credit option must exist in the select
		expect(screen.getByRole("option", { name: /Credit/i })).toBeInTheDocument();
	});

	it("shows credit limit field when type=credit selected", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		const typeSelect = screen.getByLabelText(/Sub-account type/i);
		// Select credit type
		await userEvent.selectOptions(typeSelect, "credit");
		// Credit limit input should appear
		expect(screen.getByLabelText(/Credit limit/i)).toBeInTheDocument();
	});

	it("hides credit limit field for non-credit types", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		// Default type should be wallet — no credit limit field
		expect(screen.queryByLabelText(/Credit limit/i)).toBeNull();
	});
});

// ============================================================================
// Credit card balance setup — remaining available field
// ============================================================================

describe("SubAccountModal credit — remaining available field", () => {
	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[walletSubAccount], true]);
	});

	it("shows 'Remaining available' field when type=credit in create mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		const typeSelect = screen.getByLabelText(/Sub-account type/i);
		await userEvent.selectOptions(typeSelect, "credit");
		expect(screen.getByLabelText(/Remaining available/i)).toBeInTheDocument();
	});

	it("does NOT show 'Initial balance' field when type=credit in create mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		const typeSelect = screen.getByLabelText(/Sub-account type/i);
		await userEvent.selectOptions(typeSelect, "credit");
		expect(screen.queryByLabelText(/Initial balance/i)).not.toBeInTheDocument();
	});

	it("shows 'Initial balance' field for non-credit type in create mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		// Default type is wallet — initial balance should appear
		expect(screen.getByLabelText(/Initial balance/i)).toBeInTheDocument();
	});

	it("does NOT show 'Remaining available' field for non-credit type", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		// Default type is wallet — no remaining available field
		expect(screen.queryByLabelText(/Remaining available/i)).not.toBeInTheDocument();
	});
});

describe("SubAccountModal credit edit — remaining available field", () => {
	const editCreditSubAccount = {
		id: 1n,
		name: "RCBC Credit",
		subAccountType: "credit",
		creditLimitCentavos: 12000000n, // P120,000
		balanceCentavos: 620000n, // P6,200 outstanding → (12000000 - 620000) / 100 = 113800.00 remaining
	};

	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[], true]);
	});

	it("shows 'Remaining available' field in edit mode for credit sub-account", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
				subAccount={editCreditSubAccount}
			/>,
		);
		expect(screen.getByLabelText(/Remaining available/i)).toBeInTheDocument();
	});

	it("pre-fills remaining available as (limit - outstanding) in edit mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
				subAccount={editCreditSubAccount}
			/>,
		);
		// remaining = (12000000 - 620000) / 100 = 113800.00
		expect(screen.getByDisplayValue("113800.00")).toBeInTheDocument();
	});
});

// ============================================================================
// CRDT-02: TransactionModal credit hint
// ============================================================================

describe("TransactionModal credit hint", () => {
	// useTable call order in TransactionModal:
	// (1) my_accounts, (2) my_sub_accounts, (3) my_budget_config, (4) my_budget_allocations, (5) my_transactions, (6) my_tag_configs
	function setupTransactionModalMocks() {
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => {
			const idx = callCount % 6;
			callCount++;
			if (idx === 0) return [[mockAccount], true]; // my_accounts
			if (idx === 1) return [[creditSubAccount, walletSubAccount], true]; // my_sub_accounts
			if (idx === 2) return [[], true]; // my_budget_config
			if (idx === 3) return [[], true]; // my_budget_allocations
			if (idx === 4) return [[], true]; // my_transactions
			return [[], true]; // my_tag_configs
		});
	}

	it("shows credit available hint when credit partition selected as expense source", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);

		// Select credit partition from the source dropdown (expense mode is default)
		const sourceSelect = screen.getByRole("combobox", { name: /from/i });
		await userEvent.selectOptions(sourceSelect, creditSubAccount.id.toString());

		// Enter an amount well under the limit
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "100");

		// Credit hint should appear
		expect(screen.getByText(/Credit available/i)).toBeInTheDocument();
	});

	it("shows over-limit warning when amount exceeds available credit", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);

		// Select credit partition
		const sourceSelect = screen.getByRole("combobox", { name: /from/i });
		await userEvent.selectOptions(sourceSelect, creditSubAccount.id.toString());

		// Available credit = 120000 - 6200 = 113800
		// Enter P114200 which exceeds available P113,800 by P400
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "114200");

		// Over-limit warning should appear
		expect(screen.getByText(/This will exceed your credit limit/i)).toBeInTheDocument();
	});

	it("does NOT show credit hint when wallet partition selected", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);

		// Select wallet partition
		const sourceSelect = screen.getByRole("combobox", { name: /from/i });
		await userEvent.selectOptions(sourceSelect, walletSubAccount.id.toString());

		// Credit hint should NOT appear
		expect(screen.queryByText(/Credit available/i)).toBeNull();
	});
});

// ============================================================================
// CRDT-01, CRDT-03: PayCreditModal
// ============================================================================

describe("PayCreditModal", () => {
	beforeEach(() => {
		// Only non-credit partitions shown in pay-from selector
		vi.mocked(useTable).mockReturnValue([[walletSubAccount], true]);
	});

	it("renders Pay Credit modal title", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal subAccountId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByText("Pay Credit")).toBeInTheDocument();
	});

	it("renders amount pre-filled with outstanding balance", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal subAccountId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		// P6,200 = 620000 centavos = "6200.00"
		const amountInput = screen.getByLabelText(/^Amount$/i);
		expect((amountInput as HTMLInputElement).value).toBe("6200.00");
	});

	it("dismiss button is labeled Keep balance", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal subAccountId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByRole("button", { name: /Keep balance/i })).toBeInTheDocument();
	});

	it("submit button is labeled Confirm payment", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal subAccountId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByRole("button", { name: /Confirm payment/i })).toBeInTheDocument();
	});

	it("renders Service fee input field", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal subAccountId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByLabelText(/Service fee/i)).toBeInTheDocument();
	});
});

// ============================================================================
// SubAccountModal edit mode
// ============================================================================

describe("SubAccountModal edit mode", () => {
	const editSubAccount = {
		id: 1n,
		accountId: 1n,
		name: "RCBC Credit",
		balanceCentavos: 620000n,
		subAccountType: "credit",
		creditLimitCentavos: 12000000n,
		isDefault: false,
		createdAt: { microsSinceUnixEpoch: 0n },
	};

	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[], true]);
	});

	it("renders 'Edit partition' title in edit mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
				subAccount={editSubAccount}
			/>,
		);
		expect(screen.getByText("Edit sub-account")).toBeInTheDocument();
	});

	it("pre-fills name and credit limit from partition prop", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
				subAccount={editSubAccount}
			/>,
		);
		expect(screen.getByDisplayValue("RCBC Credit")).toBeInTheDocument();
		expect(screen.getByDisplayValue("120000.00")).toBeInTheDocument();
	});

	it("sub-account type select is disabled in edit mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
				subAccount={editSubAccount}
			/>,
		);
		const typeSelect = screen.getByLabelText(/Sub-account type/i);
		expect(typeSelect).toBeDisabled();
	});

	it("does not show initial balance field in edit mode", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Test"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
				subAccount={editSubAccount}
			/>,
		);
		expect(screen.queryByLabelText(/Initial balance/i)).not.toBeInTheDocument();
	});
});
