import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PayCreditModal } from "../components/PayCreditModal";
import { SubAccountCard } from "../components/SubAccountCard";
import { SubAccountModal } from "../components/SubAccountModal";
import { TransactionModal } from "../components/TransactionModal";
import { getReducerSpy } from "./setup";

const creditSubAccount = {
	id: 1n,
	accountId: 1n,
	name: "RCBC/Credit",
	balanceCentavos: 620000n,
	isDefault: false,
	createdAt: { microsSinceUnixEpoch: 0n },
	subAccountType: "credit",
	creditLimitCentavos: 12000000n,
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

describe("SubAccountCard credit variant — available calculation", () => {
	const creditCardProps = {
		id: creditSubAccount.id,
		name: creditSubAccount.name,
		balanceCentavos: creditSubAccount.balanceCentavos,
		subAccountType: creditSubAccount.subAccountType,
		creditLimitCentavos: creditSubAccount.creditLimitCentavos,
		onDeleteRequest: vi.fn(),
		onPayCredit: vi.fn(),
		onEdit: vi.fn(),
	};

	it("shows available = limit - outstanding in pesos", () => {
		render(<SubAccountCard {...creditCardProps} />);
		// 12,000,000 − 620,000 = 11,380,000 centavos → P113,800.00
		expect(screen.getByText(/P113,800/)).toBeInTheDocument();
		expect(screen.getByText(/P120,000/)).toBeInTheDocument();
	});

	it("shows available percentage", () => {
		render(<SubAccountCard {...creditCardProps} />);
		expect(screen.getByText(/95% available/)).toBeInTheDocument();
	});
});

describe("SubAccountModal credit fields", () => {
	const baseProps = {
		accountId: 1n,
		accountName: "Test",
		isStandalone: false,
		existingBalanceCentavos: 0n,
		onClose: vi.fn(),
	};

	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[walletSubAccount], true]);
	});

	it("Credit option exists in sub-account type select", () => {
		render(<SubAccountModal {...baseProps} />);
		expect(screen.getByRole("option", { name: /Credit/i })).toBeInTheDocument();
	});

	it("shows credit limit + remaining available fields when type=credit, hides initial balance", async () => {
		render(<SubAccountModal {...baseProps} />);
		await userEvent.selectOptions(screen.getByLabelText(/Sub-account type/i), "credit");
		expect(screen.getByLabelText(/Credit limit/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Remaining available/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/Initial balance/i)).not.toBeInTheDocument();
	});

	it("wallet type shows initial balance but not credit limit / remaining available", () => {
		render(<SubAccountModal {...baseProps} />);
		expect(screen.getByLabelText(/Initial balance/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/Credit limit/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/Remaining available/i)).not.toBeInTheDocument();
	});
});

describe("SubAccountModal credit edit mode", () => {
	const editCreditSubAccount = {
		id: 1n,
		name: "RCBC Credit",
		subAccountType: "credit",
		creditLimitCentavos: 12000000n,
		balanceCentavos: 620000n,
	};
	const baseProps = {
		accountId: 1n,
		accountName: "Test",
		isStandalone: false,
		existingBalanceCentavos: 0n,
		onClose: vi.fn(),
	};

	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[], true]);
	});

	it("pre-fills remaining available as (limit - outstanding) in pesos", () => {
		render(<SubAccountModal {...baseProps} subAccount={editCreditSubAccount} />);
		// (12_000_000 − 620_000) / 100 = 113_800.00
		expect(screen.getByDisplayValue("113800.00")).toBeInTheDocument();
	});

	it("submit editSubAccount: newBalanceCentavos = creditLimit − remainingAvailable", async () => {
		const editSubAccount = getReducerSpy("editSubAccount");
		const user = userEvent.setup();
		render(<SubAccountModal {...baseProps} subAccount={editCreditSubAccount} />);

		// User changes remaining 113_800 → 100_000 (spent ₱13,800 more).
		// Expected new outstanding: 12_000_000 − 10_000_000 = 2_000_000.
		const remaining = screen.getByLabelText(/Remaining available/i);
		await user.clear(remaining);
		await user.type(remaining, "100000");
		await user.click(screen.getByRole("button", { name: /update RCBC Credit/i }));

		await waitFor(() => expect(editSubAccount).toHaveBeenCalledTimes(1));
		expect(editSubAccount).toHaveBeenCalledWith({
			subAccountId: 1n,
			newName: "RCBC Credit",
			newCreditLimitCentavos: 12_000_000n,
			newBalanceCentavos: 2_000_000n,
		});
	});

	it("sub-account type select is disabled in edit mode", () => {
		render(<SubAccountModal {...baseProps} subAccount={editCreditSubAccount} />);
		expect(screen.getByLabelText(/Sub-account type/i)).toBeDisabled();
	});

	it("does not show initial balance field in edit mode", () => {
		render(<SubAccountModal {...baseProps} subAccount={editCreditSubAccount} />);
		expect(screen.queryByLabelText(/Initial balance/i)).not.toBeInTheDocument();
	});

	it("pre-fills name and credit limit (in pesos)", () => {
		render(<SubAccountModal {...baseProps} subAccount={editCreditSubAccount} />);
		expect(screen.getByDisplayValue("RCBC Credit")).toBeInTheDocument();
		expect(screen.getByDisplayValue("120000.00")).toBeInTheDocument();
	});
});

describe("TransactionModal credit hint", () => {
	// useTable call order in TransactionModal:
	// (1) my_accounts, (2) my_sub_accounts, (3) my_budget_config,
	// (4) my_budget_allocations, (5) my_transactions, (6) my_tag_configs
	function setupMocks() {
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => {
			const idx = callCount % 6;
			callCount++;
			if (idx === 0) return [[mockAccount], true];
			if (idx === 1) return [[creditSubAccount, walletSubAccount], true];
			return [[], true];
		});
	}

	it("shows credit-available hint when credit source is selected", async () => {
		setupMocks();
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: /from/i }),
			creditSubAccount.id.toString(),
		);
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "100");
		expect(screen.getByText(/Credit available/i)).toBeInTheDocument();
	});

	it("shows over-limit warning when amount exceeds available credit", async () => {
		setupMocks();
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: /from/i }),
			creditSubAccount.id.toString(),
		);
		// Available = 120_000 − 6_200 = 113_800. 114_200 exceeds by ₱400.
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "114200");
		expect(screen.getByText(/This will exceed your credit limit/i)).toBeInTheDocument();
	});

	it("does NOT show credit hint when wallet source is selected", async () => {
		setupMocks();
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: /from/i }),
			walletSubAccount.id.toString(),
		);
		expect(screen.queryByText(/Credit available/i)).toBeNull();
	});
});

describe("PayCreditModal pre-fill", () => {
	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[walletSubAccount], true]);
	});

	it("pre-fills amount with outstanding balance in pesos", () => {
		render(<PayCreditModal subAccountId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		// 620_000 centavos → "6200.00"
		const amountInput = screen.getByLabelText(/^Amount$/i) as HTMLInputElement;
		expect(amountInput.value).toBe("6200.00");
	});
});
