import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { useTable } from "spacetimedb/react";
import { describe, expect, it, vi } from "vitest";
import { Fab } from "../components/Fab";

function mockEmptyTables() {
	vi.mocked(useTable).mockImplementation(() => [[], false] as never);
}

function renderFab(initialPath = "/overview") {
	return render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Fab />
		</MemoryRouter>,
	);
}

describe("Fab — speed-dial menu", () => {
	it("renders the Create new trigger", () => {
		mockEmptyTables();
		renderFab();
		expect(screen.getByRole("button", { name: /Create new/i })).toBeInTheDocument();
	});

	it("exposes all 7 actions when expanded", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		expect(screen.getByRole("button", { name: /New transaction/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /New subscription/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /New installment/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /New debt/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /New split/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /New sub-account/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /New account/i })).toBeInTheDocument();
	});
});

describe("Fab — opens correct modal per action", () => {
	it("New transaction opens TransactionModal", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New transaction/i }));
		expect(screen.getByRole("heading", { name: /New transaction/i })).toBeInTheDocument();
	});

	it("New subscription opens RecurringModal in subscription mode", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New subscription/i }));
		expect(screen.getByRole("heading", { name: /New subscription/i })).toBeInTheDocument();
	});

	it("New installment opens RecurringModal in installment mode", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New installment/i }));
		expect(screen.getByRole("heading", { name: /New installment/i })).toBeInTheDocument();
	});

	it("New debt opens DebtModal", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New debt/i }));
		expect(screen.getByRole("heading", { name: /New debt/i })).toBeInTheDocument();
	});

	it("New split opens SplitModal", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New split/i }));
		expect(screen.getByRole("heading", { name: /New split/i })).toBeInTheDocument();
	});

	it("New sub-account opens SubAccountModal", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New sub-account/i }));
		expect(screen.getByRole("heading", { name: /New sub-account/i })).toBeInTheDocument();
	});
});

describe("Fab — New account flow", () => {
	it("opens AccountModal", async () => {
		mockEmptyTables();
		const user = userEvent.setup();
		renderFab();
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New account/i }));
		expect(screen.getByRole("heading", { name: /New account/i })).toBeInTheDocument();
	});
});

describe("Fab — context-aware pre-fills on /accounts/:id", () => {
	const accounts = [{ id: 10n, name: "Maya", isStandalone: false }];
	const subAccounts = [
		{
			id: 1n,
			accountId: 10n,
			name: "Wallet",
			balanceCentavos: 0n,
			isDefault: false,
			subAccountType: "wallet",
			creditLimitCentavos: 0n,
		},
		{
			id: 2n,
			accountId: 10n,
			name: "Savings",
			balanceCentavos: 0n,
			isDefault: false,
			subAccountType: "savings",
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
	}

	it("on /accounts/:id, New transaction pre-selects first sub-account as source", async () => {
		mockTables();
		const user = userEvent.setup();
		renderFab("/accounts/10");
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New transaction/i }));
		const fromSelect = screen.getByRole("combobox", { name: /^From$/i }) as HTMLSelectElement;
		expect(fromSelect.value).toBe("1");
	});

	it("on /accounts/:id, New sub-account pre-selects current account in selector", async () => {
		mockTables();
		const user = userEvent.setup();
		renderFab("/accounts/10");
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New sub-account/i }));
		const accountSelect = screen.getByLabelText(/^Account$/i) as HTMLSelectElement;
		expect(accountSelect.value).toBe("10");
	});

	it("on /overview, New transaction opens with no source pre-fill", async () => {
		mockTables();
		const user = userEvent.setup();
		renderFab("/overview");
		await user.click(screen.getByRole("button", { name: /Create new/i }));
		await user.click(screen.getByRole("button", { name: /New transaction/i }));
		const fromSelect = screen.getByRole("combobox", { name: /^From$/i }) as HTMLSelectElement;
		expect(fromSelect.value).toBe("");
	});
});
