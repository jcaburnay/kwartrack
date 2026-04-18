import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { useReducer, useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReducerSpy } from "./setup";

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

describe("SubAccountModal standalone use (no accountId provided)", () => {
	const accounts = [
		{ id: 10n, name: "Maya", isStandalone: false },
		{ id: 20n, name: "GCash", isStandalone: true },
	];
	const subAccounts = [
		{
			id: 1n,
			accountId: 10n,
			name: "Wallet",
			balanceCentavos: 50000n,
			isDefault: false,
			subAccountType: "wallet",
			creditLimitCentavos: 0n,
		},
		{
			id: 99n,
			accountId: 20n,
			name: "Default",
			balanceCentavos: 200000n,
			isDefault: true,
			subAccountType: "wallet",
			creditLimitCentavos: 0n,
		},
	];

	function mockTables() {
		vi.mocked(useTable).mockImplementation((table: { name?: string } | unknown) => {
			const name = (table as { name?: string } | undefined)?.name;
			if (name === "my_accounts") return [accounts, false] as never;
			if (name === "my_sub_accounts") return [subAccounts, false] as never;
			return [[], false] as never;
		});
		// Reset useReducer to default (route to shared reducer spies) — earlier
		// describe block overrides this with a stub that only handles
		// convertAndCreateSubAccount, which would otherwise leak into these tests.
		vi.mocked(useReducer).mockImplementation((reducer: { accessorName?: string } | unknown) => {
			const accessorName = (reducer as { accessorName?: string } | undefined)?.accessorName;
			if (accessorName) return getReducerSpy(accessorName) as never;
			return vi.fn() as never;
		});
	}

	it("renders an account selector when accountId is not provided", async () => {
		mockTables();
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(<SubAccountModal onClose={() => {}} />);
		expect(screen.getByLabelText(/^Account$/i)).toBeInTheDocument();
	});

	it("does not render an account selector when accountId is provided", async () => {
		mockTables();
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(
			<SubAccountModal
				accountId={10n}
				accountName="Maya"
				isStandalone={false}
				existingBalanceCentavos={0n}
				onClose={() => {}}
			/>,
		);
		expect(screen.queryByLabelText(/^Account$/i)).not.toBeInTheDocument();
	});

	it("defaultAccountId pre-selects the corresponding account in the selector", async () => {
		mockTables();
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(<SubAccountModal onClose={() => {}} defaultAccountId={20n} />);
		const select = screen.getByLabelText(/^Account$/i) as HTMLSelectElement;
		expect(select.value).toBe("20");
	});

	it("submits with the selected accountId when picking from selector", async () => {
		mockTables();
		const addSubAccount = getReducerSpy("addSubAccount");
		const user = userEvent.setup();
		const { SubAccountModal } = await import("../components/SubAccountModal");
		render(<SubAccountModal onClose={() => {}} defaultAccountId={10n} />);
		await user.type(screen.getByLabelText(/Sub-account name/i), "Bonus");
		await user.click(screen.getByRole("button", { name: /Save/i }));
		await waitFor(() => expect(addSubAccount).toHaveBeenCalledTimes(1));
		expect(addSubAccount).toHaveBeenCalledWith(
			expect.objectContaining({ accountId: 10n, name: "Bonus" }),
		);
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
