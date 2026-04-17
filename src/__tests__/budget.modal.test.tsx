import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTable } from "spacetimedb/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetModal } from "../components/BudgetModal";
import { TransactionModal } from "../components/TransactionModal";
import { getReducerSpy } from "./setup";

const now = new Date();

describe("BudgetModal", () => {
	it("auto-appends a new empty row when a tag is selected", async () => {
		render(<BudgetModal onClose={vi.fn()} />);
		// Initial: one empty row (combobox + totalAmount spinbutton).
		expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
		await userEvent.selectOptions(screen.getByRole("combobox", { name: /select tag/i }), "foods");
		// After: foods row + new empty row = 2 comboboxes, 2 spinbuttons (empty row has no amount input).
		expect(screen.getAllByRole("combobox")).toHaveLength(2);
		expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
	});

	it("submits setBudget (centavos-converted total) + setBudgetAllocations (only rows with amounts)", async () => {
		const setBudget = getReducerSpy("setBudget");
		const setBudgetAllocations = getReducerSpy("setBudgetAllocations");
		const user = userEvent.setup();

		render(<BudgetModal onClose={vi.fn()} />);
		const spinbuttons = () => screen.getAllByRole("spinbutton");
		const comboboxes = () => screen.getAllByRole("combobox");

		await user.type(spinbuttons()[0], "50000");

		await user.selectOptions(comboboxes()[0], "foods");
		await user.type(spinbuttons()[1], "10000");

		await user.selectOptions(comboboxes()[1], "grocery");
		await user.type(spinbuttons()[2], "7500.50");

		// Third row left with no amount — should be filtered out of allocations payload.
		await user.selectOptions(comboboxes()[2], "transportation");

		await user.click(screen.getByRole("button", { name: /save|update budget/i }));

		await waitFor(() => expect(setBudget).toHaveBeenCalledTimes(1));
		expect(setBudget).toHaveBeenCalledWith({ totalCentavos: 5_000_000n });

		await waitFor(() => expect(setBudgetAllocations).toHaveBeenCalledTimes(1));
		const allocArg = setBudgetAllocations.mock.calls[0][0] as {
			allocations: { tag: string; allocatedCentavos: bigint }[];
		};
		expect(allocArg.allocations).toEqual([
			{ tag: "foods", allocatedCentavos: 1_000_000n },
			{ tag: "grocery", allocatedCentavos: 750_050n },
		]);
		expect(allocArg.allocations.find((a) => a.tag === "transportation")).toBeUndefined();
	});
});

describe("TransactionModal budget hint", () => {
	const mockBudgetConfig = [
		{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null },
	];
	const mockAllocations = [
		{ id: 1n, ownerIdentity: null, tag: "grocery", allocatedCentavos: 500000n, updatedAt: null },
	];
	const mockTxnForHint = {
		type: "expense",
		tag: "grocery",
		amountCentavos: 100000n,
		date: { microsSinceUnixEpoch: BigInt(now.getTime()) * 1000n },
	};

	// useTable call order in TransactionModal:
	// (1) my_accounts, (2) my_sub_accounts, (3) my_budget_config,
	// (4) my_budget_allocations, (5) my_transactions, (6) my_tag_configs
	function setupMocks(
		budgetConfig = mockBudgetConfig,
		allocations = mockAllocations,
		transactions = [mockTxnForHint],
	) {
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => {
			const idx = callCount % 6;
			callCount++;
			if (idx === 2) return [budgetConfig, true];
			if (idx === 3) return [allocations, true];
			if (idx === 4) return [transactions, true];
			return [[], true];
		});
	}

	it("shows 'Budget remaining' hint when expense tag has an allocation", async () => {
		setupMocks();
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.selectOptions(screen.getByRole("combobox", { name: /tag/i }), "grocery");
		expect(screen.getByRole("status")).toHaveTextContent(/Budget remaining/);
	});

	it("shows '⚠ This will exceed' when entered amount exceeds remaining allocation", async () => {
		// Allocation 500,000 − already-spent 490,000 = remaining 10,000 (₱100).
		const mockTxnAlmostOver = {
			...mockTxnForHint,
			amountCentavos: 490000n,
		};
		setupMocks(mockBudgetConfig, mockAllocations, [mockTxnAlmostOver]);
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.selectOptions(screen.getByRole("combobox", { name: /tag/i }), "grocery");
		// Enter ₱200 — exceeds the ₱100 remaining.
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "200");
		expect(screen.getByRole("status")).toHaveTextContent(/⚠ This will exceed/);
	});

	it("hides budget hint when transaction type is income", async () => {
		setupMocks();
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.click(screen.getByRole("button", { name: /income/i }));
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
