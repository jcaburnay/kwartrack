import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubAccountCard } from "../components/SubAccountCard";
import { SubAccountModal } from "../components/SubAccountModal";

const mockCreateTimeDeposit = vi.fn();
const mockAddSubAccount = vi.fn();
const mockConvertAndCreate = vi.fn();
const mockEditSubAccount = vi.fn();
const mockEditTimeDepositMetadata = vi.fn();

vi.mock("spacetimedb/react", async (importOriginal) => {
	const original = await importOriginal<typeof import("spacetimedb/react")>();
	return {
		...original,
		useReducer: vi.fn((reducer) => {
			if (reducer?.accessorName === "createTimeDeposit") return mockCreateTimeDeposit;
			if (reducer?.accessorName === "addSubAccount") return mockAddSubAccount;
			if (reducer?.accessorName === "convertAndCreateSubAccount") return mockConvertAndCreate;
			if (reducer?.accessorName === "editSubAccount") return mockEditSubAccount;
			if (reducer?.accessorName === "editTimeDepositMetadata") return mockEditTimeDepositMetadata;
			return vi.fn();
		}),
	};
});

describe("SubAccountModal — time deposit fields", () => {
	const baseProps = {
		accountId: 1n,
		accountName: "Maya",
		isStandalone: false,
		existingBalanceCentavos: 0n,
		onClose: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does NOT show interest rate or maturity date for wallet type", () => {
		render(<SubAccountModal {...baseProps} />);
		expect(screen.queryByLabelText(/interest rate/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/maturity date/i)).not.toBeInTheDocument();
	});

	it("shows interest rate and maturity date fields when time-deposit is selected", async () => {
		render(<SubAccountModal {...baseProps} />);
		const typeSelect = screen.getByLabelText(/sub-account type/i) as HTMLSelectElement;
		await userEvent.selectOptions(typeSelect, "time-deposit");
		expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/maturity date/i)).toBeInTheDocument();
	});

	it("calls createTimeDeposit reducer with centavos balance, bps-converted rate, and accountId", async () => {
		render(<SubAccountModal {...baseProps} />);
		await userEvent.type(screen.getByLabelText(/sub-account name/i), "  6-Month TD  ");
		const typeSelect = screen.getByLabelText(/sub-account type/i) as HTMLSelectElement;
		await userEvent.selectOptions(typeSelect, "time-deposit");
		await userEvent.type(screen.getByLabelText(/initial balance/i), "100000");
		await userEvent.type(screen.getByLabelText(/interest rate/i), "6.25");
		await userEvent.type(screen.getByLabelText(/maturity date/i), "2027-01-01");
		await userEvent.click(screen.getByRole("button", { name: /save/i }));
		expect(mockCreateTimeDeposit).toHaveBeenCalledTimes(1);
		expect(mockAddSubAccount).not.toHaveBeenCalled();
		expect(mockCreateTimeDeposit).toHaveBeenCalledWith(
			expect.objectContaining({
				accountId: 1n,
				name: "6-Month TD",
				initialBalanceCentavos: 10_000_000n, // ₱100,000 × 100
				interestRateBps: 625, // 6.25% × 100
			}),
		);
	});

	it("editing a time deposit calls editTimeDepositMetadata with subAccountId and rate — NOT editSubAccount", async () => {
		const tdSubAccount = {
			id: 5n,
			name: "6-Month TD",
			subAccountType: "time-deposit",
			creditLimitCentavos: 0n,
			balanceCentavos: 10_000_000n,
			interestRateBps: 600,
			maturityDate: new Date("2027-01-01"),
		};
		render(<SubAccountModal {...baseProps} subAccount={tdSubAccount} />);
		// Change the interest rate to verify the rate-bps conversion in edit mode too.
		const rateInput = screen.getByLabelText(/interest rate/i);
		await userEvent.clear(rateInput);
		await userEvent.type(rateInput, "7");
		await userEvent.click(screen.getByRole("button", { name: /update/i }));
		expect(mockEditTimeDepositMetadata).toHaveBeenCalledTimes(1);
		expect(mockEditSubAccount).not.toHaveBeenCalled();
		expect(mockEditTimeDepositMetadata).toHaveBeenCalledWith(
			expect.objectContaining({
				subAccountId: 5n,
				interestRateBps: 700,
			}),
		);
	});
});

describe("SubAccountCard — time deposit display", () => {
	const baseProps = {
		id: 1n,
		name: "6-Month TD",
		balanceCentavos: 10_000_000n,
		subAccountType: "time-deposit",
		creditLimitCentavos: 0n,
		onDeleteRequest: vi.fn(),
	};

	it("shows interest rate badge for time deposit", () => {
		render(
			<SubAccountCard
				{...baseProps}
				interestRateBps={600}
				maturityDate={new Date("2027-01-01")}
				isMatured={false}
			/>,
		);
		expect(screen.getByText("6.00% p.a.")).toBeInTheDocument();
	});

	it("shows maturity date for time deposit", () => {
		render(
			<SubAccountCard
				{...baseProps}
				interestRateBps={600}
				maturityDate={new Date("2027-01-01")}
				isMatured={false}
			/>,
		);
		expect(screen.getByText(/Matures/i)).toBeInTheDocument();
	});

	it('shows "Matured" badge when isMatured is true', () => {
		render(
			<SubAccountCard
				{...baseProps}
				interestRateBps={600}
				maturityDate={new Date("2026-01-01")}
				isMatured={true}
			/>,
		);
		expect(screen.getByText("Matured")).toBeInTheDocument();
	});

	it('does NOT show "Matured" badge for non-matured TD', () => {
		render(
			<SubAccountCard
				{...baseProps}
				interestRateBps={600}
				maturityDate={new Date("2027-01-01")}
				isMatured={false}
			/>,
		);
		expect(screen.queryByText("Matured")).not.toBeInTheDocument();
	});

	it("does not show interest rate info for wallet type", () => {
		render(<SubAccountCard {...baseProps} subAccountType="wallet" />);
		expect(screen.queryByText(/p\.a\./i)).not.toBeInTheDocument();
	});
});
