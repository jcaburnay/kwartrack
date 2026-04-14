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

	it("calls createTimeDeposit reducer when saving a new time deposit", async () => {
		render(<SubAccountModal {...baseProps} />);
		await userEvent.type(screen.getByLabelText(/sub-account name/i), "6-Month TD");
		const typeSelect = screen.getByLabelText(/sub-account type/i) as HTMLSelectElement;
		await userEvent.selectOptions(typeSelect, "time-deposit");
		await userEvent.type(screen.getByLabelText(/initial balance/i), "100000");
		await userEvent.type(screen.getByLabelText(/interest rate/i), "6");
		await userEvent.type(screen.getByLabelText(/maturity date/i), "2027-01-01");
		await userEvent.click(screen.getByRole("button", { name: /save/i }));
		expect(mockCreateTimeDeposit).toHaveBeenCalledOnce();
		expect(mockAddSubAccount).not.toHaveBeenCalled();
	});

	it("calls editTimeDepositMetadata when editing a time deposit", async () => {
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
		expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/maturity date/i)).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: /update/i }));
		expect(mockEditTimeDepositMetadata).toHaveBeenCalledOnce();
		expect(mockEditSubAccount).not.toHaveBeenCalled();
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
