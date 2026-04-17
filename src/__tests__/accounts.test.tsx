import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { useReducer, useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPesos } from "../utils/currency";
import { getReducerSpy } from "./setup";

// =============================================================================
// formatPesos unit tests — these are GREEN immediately (no component dependency)
// =============================================================================
describe("formatPesos", () => {
	it("formats 0 centavos as P0.00", () => {
		expect(formatPesos(0n)).toBe("P0.00");
	});
	it("formats 500 centavos as P5.00", () => {
		expect(formatPesos(500n)).toBe("P5.00");
	});
	it("formats 12050000 centavos as P120,500.00", () => {
		expect(formatPesos(12050000n)).toBe("P120,500.00");
	});
	it("formats 100 centavos as P1.00", () => {
		expect(formatPesos(100n)).toBe("P1.00");
	});
});

// =============================================================================
// AccountsPage tests — RED until Plan 03 creates AccountsPage
// =============================================================================
describe("AccountsPage", () => {
	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[], true]);
	});

	it("renders ACCOUNTS section heading", async () => {
		const { AccountsPage } = await import("../pages/AccountsPage");
		render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("Accounts")).toBeInTheDocument();
	});

	it("renders empty state when no accounts and isReady=true", async () => {
		vi.mocked(useTable).mockReturnValue([[], true]);
		const { AccountsPage } = await import("../pages/AccountsPage");
		render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("New account")).toBeInTheDocument();
	});

	it("renders nothing when isReady=false", async () => {
		vi.mocked(useTable).mockReturnValue([[], false]);
		const { AccountsPage } = await import("../pages/AccountsPage");
		const { container } = render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		expect(container).toBeEmptyDOMElement();
	});
});

// =============================================================================
// AccountModal tests — RED until Plan 03 creates AccountModal
// =============================================================================
describe("AccountModal", () => {
	it('shows "Account name is required" when name is empty on submit', async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: /save account/i }));
		await waitFor(() => expect(screen.getByText("Account name is required")).toBeInTheDocument());
	});

	it('shows "Save Maya" when name field contains "Maya"', async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		fireEvent.change(screen.getByPlaceholderText(/maya, gcash, rcbc/i), {
			target: { value: "Maya" },
		});
		expect(screen.getByRole("button", { name: "Save Maya" })).toBeInTheDocument();
	});

	it("shows standalone hint when initial balance > 0", async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		fireEvent.change(screen.getByPlaceholderText("0.00"), {
			target: { value: "1000" },
		});
		expect(
			screen.getByText("Initial balance set — this will be a standalone account"),
		).toBeInTheDocument();
	});

	it("submits createAccount with trimmed name, centavos-converted initial balance, and undefined iconBankId", async () => {
		const spy = getReducerSpy("createAccount");
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);

		fireEvent.change(screen.getByPlaceholderText(/maya, gcash, rcbc/i), {
			target: { value: "  Savings  " },
		});
		fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "1234.56" } });
		fireEvent.click(screen.getByRole("button", { name: /save savings/i }));

		await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
		expect(spy).toHaveBeenCalledWith({
			name: "Savings",
			initialBalanceCentavos: 123_456n,
			iconBankId: undefined,
		});
	});

	it("defaults initialBalanceCentavos to 0n when the balance field is left empty", async () => {
		const spy = getReducerSpy("createAccount");
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);

		fireEvent.change(screen.getByPlaceholderText(/maya, gcash, rcbc/i), {
			target: { value: "Maya" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save maya/i }));

		await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ initialBalanceCentavos: 0n, name: "Maya" }),
		);
	});
});

// =============================================================================
// SubAccountModal tests
// =============================================================================
describe("SubAccountModal", () => {
	it('shows "Sub-account name is required" when name is empty on submit', async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Maya"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /save sub-account/i }));
		await waitFor(() =>
			expect(screen.getByText("Sub-account name is required")).toBeInTheDocument(),
		);
	});

	it("shows conversion section when isStandalone=true and balance > 0", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Maya"
				isStandalone={true}
				existingBalanceCentavos={1000000n}
				onClose={vi.fn()}
			/>,
		);
		expect(screen.getByText(/maya's existing balance/i)).toBeInTheDocument();
		expect(screen.getByDisplayValue("Main")).toBeInTheDocument();
	});

	it("hides conversion section when isStandalone=true but balance is 0", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Maya"
				isStandalone={true}
				existingBalanceCentavos={0n}
				onClose={vi.fn()}
			/>,
		);
		expect(screen.queryByText(/existing balance/i)).not.toBeInTheDocument();
	});
});

// =============================================================================
// SubAccountModal standalone conversion — initial balance for the NEW sub-account
// =============================================================================
describe("SubAccountModal standalone conversion — new sub-account initial balance", () => {
	it("shows Initial balance field for wallet type when isStandalone=true", async () => {
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Maya"
				isStandalone={true}
				existingBalanceCentavos={1000000n}
				onClose={vi.fn()}
			/>,
		);
		expect(screen.getByLabelText(/Initial balance/i)).toBeInTheDocument();
	});

	it("calls convertAndCreateSubAccount with newSubAccountInitialBalanceCentavos from the form", async () => {
		const mockConvertAndCreate = vi.fn();
		vi.mocked(useReducer).mockImplementation((reducer) => {
			if ((reducer as { accessorName?: string }).accessorName === "convertAndCreateSubAccount") {
				return mockConvertAndCreate;
			}
			return vi.fn();
		});

		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={1n}
				accountName="Maya"
				isStandalone={true}
				existingBalanceCentavos={1000000n}
				onClose={vi.fn()}
			/>,
		);

		await userEvent.type(screen.getByLabelText(/Sub-account name/i), "New Savings");
		await userEvent.type(screen.getByLabelText(/Initial balance/i), "500");
		fireEvent.click(screen.getByRole("button", { name: /Save New Savings/i }));

		await waitFor(() => {
			expect(mockConvertAndCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					newSubAccountInitialBalanceCentavos: 50000n,
				}),
			);
		});
	});
});

// =============================================================================
// DeleteConfirmModal tests — RED until Plan 04 creates DeleteConfirmModal
// =============================================================================
describe("DeleteConfirmModal", () => {
	it("renders title, confirm button, and dismiss button with item names", async () => {
		const { DeleteConfirmModal } = await import("../components/DeleteConfirmModal");
		render(
			<DeleteConfirmModal
				title="Delete Maya?"
				body="This will permanently delete Maya and all its sub-accounts."
				confirmLabel="Delete Maya"
				dismissLabel="Keep Maya"
				onConfirm={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		expect(screen.getByText("Delete Maya?")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Delete Maya" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Keep Maya" })).toBeInTheDocument();
	});
});
