import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SubAccountModal } from "../components/SubAccountModal";
import { getReducerSpy } from "./setup";

describe("SubAccountModal — time deposit fields", () => {
	const baseProps = {
		accountId: 1n,
		accountName: "Maya",
		isStandalone: false,
		existingBalanceCentavos: 0n,
		onClose: vi.fn(),
	};

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
		const createTimeDeposit = getReducerSpy("createTimeDeposit");
		const addSubAccount = getReducerSpy("addSubAccount");
		render(<SubAccountModal {...baseProps} />);
		await userEvent.type(screen.getByLabelText(/sub-account name/i), "  6-Month TD  ");
		const typeSelect = screen.getByLabelText(/sub-account type/i) as HTMLSelectElement;
		await userEvent.selectOptions(typeSelect, "time-deposit");
		await userEvent.type(screen.getByLabelText(/initial balance/i), "100000");
		await userEvent.type(screen.getByLabelText(/interest rate/i), "6.25");
		await userEvent.type(screen.getByLabelText(/maturity date/i), "2027-01-01");
		await userEvent.click(screen.getByRole("button", { name: /save/i }));
		expect(createTimeDeposit).toHaveBeenCalledTimes(1);
		expect(addSubAccount).not.toHaveBeenCalled();
		expect(createTimeDeposit).toHaveBeenCalledWith(
			expect.objectContaining({
				accountId: 1n,
				name: "6-Month TD",
				initialBalanceCentavos: 10_000_000n,
				interestRateBps: 625,
			}),
		);
	});

	it("editing a time deposit calls editTimeDepositMetadata with subAccountId and rate — NOT editSubAccount", async () => {
		const editTimeDepositMetadata = getReducerSpy("editTimeDepositMetadata");
		const editSubAccount = getReducerSpy("editSubAccount");
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
		const rateInput = screen.getByLabelText(/interest rate/i);
		await userEvent.clear(rateInput);
		await userEvent.type(rateInput, "7");
		await userEvent.click(screen.getByRole("button", { name: /update/i }));
		expect(editTimeDepositMetadata).toHaveBeenCalledTimes(1);
		expect(editSubAccount).not.toHaveBeenCalled();
		expect(editTimeDepositMetadata).toHaveBeenCalledWith(
			expect.objectContaining({
				subAccountId: 5n,
				interestRateBps: 700,
			}),
		);
	});
});
