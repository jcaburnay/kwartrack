import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTable } from "spacetimedb/react";
import { describe, expect, it } from "vitest";
import { BudgetModal } from "../components/BudgetModal";
import { BudgetPage } from "../pages/BudgetPage";
import { computeTagStatuses, getCurrentMonthExpenses } from "../utils/budgetCompute";

// Helper: build a microseconds-since-unix-epoch BigInt from a Date
function toMicros(d: Date): bigint {
	return BigInt(d.getTime()) * 1000n;
}

// Dates for tests
const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

describe("budgetCompute", () => {
	describe("getCurrentMonthExpenses", () => {
		it("Test 1 — filters to current calendar month only", () => {
			const transactions = [
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 50000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 30000n,
					date: { microsSinceUnixEpoch: toMicros(lastMonth) },
				},
			];

			const result = getCurrentMonthExpenses(transactions);
			expect(result.get("grocery")).toBe(50000n);
			expect(result.size).toBe(1);
		});

		it("Test 2 — ignores income and transfer transactions", () => {
			const transactions = [
				{
					type: "expense",
					tag: "grocery",
					amountCentavos: 50000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "income",
					tag: "grocery",
					amountCentavos: 100000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
				{
					type: "transfer",
					tag: "grocery",
					amountCentavos: 20000n,
					date: { microsSinceUnixEpoch: toMicros(thisMonth) },
				},
			];

			const result = getCurrentMonthExpenses(transactions);
			expect(result.get("grocery")).toBe(50000n);
			expect(result.size).toBe(1);
		});
	});

	describe("computeTagStatuses", () => {
		it("Test 3 — normal case: 84% used", () => {
			const allocations = [{ tag: "grocery", allocatedCentavos: 500000n }];
			const spentByTag = new Map<string, bigint>([["grocery", 420000n]]);

			const result = computeTagStatuses(allocations, spentByTag);
			expect(result[0].percentUsed).toBe(84);
			expect(result[0].remainingCentavos).toBe(80000n);
			expect(result[0].spentCentavos).toBe(420000n);
			expect(result[0].hasAllocation).toBe(true);
		});

		it("Test 4 — at budget: 100% used, 0n remaining", () => {
			const allocations = [{ tag: "bills", allocatedCentavos: 300000n }];
			const spentByTag = new Map<string, bigint>([["bills", 300000n]]);

			const result = computeTagStatuses(allocations, spentByTag);
			expect(result[0].percentUsed).toBe(100);
			expect(result[0].remainingCentavos).toBe(0n);
		});

		it("Test 5 — unspent tag: 0 spent, 0%, full remaining", () => {
			const allocations = [{ tag: "travel", allocatedCentavos: 100000n }];
			const spentByTag = new Map<string, bigint>();

			const result = computeTagStatuses(allocations, spentByTag);
			expect(result[0].spentCentavos).toBe(0n);
			expect(result[0].percentUsed).toBe(0);
			expect(result[0].remainingCentavos).toBe(100000n);
		});
	});
});

describe("BudgetModal", () => {
	it("renders with title 'Set monthly budget'", () => {
		render(<BudgetModal onClose={vi.fn()} />);
		expect(screen.getByText("Set monthly budget")).toBeInTheDocument();
	});

	it('"Cancel" button calls onClose', async () => {
		const onClose = vi.fn();
		render(<BudgetModal onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("renders a 'Select tag' dropdown and total input by default", () => {
		render(<BudgetModal onClose={vi.fn()} />);
		// only totalAmount spinbutton — empty row has no amount input
		expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
		expect(screen.getByRole("combobox", { name: /select tag/i })).toBeInTheDocument();
	});

	it("auto-appends a new empty row when a tag is selected", async () => {
		render(<BudgetModal onClose={vi.fn()} />);
		await userEvent.selectOptions(screen.getByRole("combobox", { name: /select tag/i }), "foods");
		// foods row + new empty row = 2 comboboxes
		expect(screen.getAllByRole("combobox")).toHaveLength(2);
		// totalAmount + foods amount = 2 spinbuttons (empty row has no amount input)
		expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
	});
});

describe("BudgetPage", () => {
	it("renders empty state when no budget configured", () => {
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([[], true])
			.mockReturnValueOnce([[], true])
			.mockReturnValueOnce([[], true]);
		render(<BudgetPage />);
		expect(screen.getByText(/Set a monthly spending limit/i)).toBeInTheDocument();
	});

	it("renders hero spent amount when budget is configured", () => {
		const mockTxn = {
			type: "expense",
			tag: "grocery",
			amountCentavos: 420000n,
			date: { microsSinceUnixEpoch: toMicros(thisMonth) },
		};
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([
				[{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null }],
				true,
			])
			.mockReturnValueOnce([
				[
					{
						id: 1n,
						ownerIdentity: null,
						tag: "grocery",
						allocatedCentavos: 500000n,
						updatedAt: null,
					},
				],
				true,
			])
			.mockReturnValueOnce([[mockTxn], true]);
		render(<BudgetPage />);
		// Hero: big spent amount visible
		expect(screen.getByTestId("hero-spent")).toHaveTextContent("P4,200.00");
		// Hero: total pct visible
		expect(screen.getByTestId("hero-pct")).toHaveTextContent("21%");
	});

	it("renders mini card showing 84% for grocery tag", () => {
		const mockTxn = {
			type: "expense",
			tag: "grocery",
			amountCentavos: 420000n,
			date: { microsSinceUnixEpoch: toMicros(thisMonth) },
		};
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([
				[{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null }],
				true,
			])
			.mockReturnValueOnce([
				[
					{
						id: 1n,
						ownerIdentity: null,
						tag: "grocery",
						allocatedCentavos: 500000n,
						updatedAt: null,
					},
				],
				true,
			])
			.mockReturnValueOnce([[mockTxn], true]);
		render(<BudgetPage />);
		expect(screen.getByText(/84%/)).toBeInTheDocument();
	});

	it("renders warning tint card when category is 80%+", () => {
		const mockTxn = {
			type: "expense",
			tag: "grocery",
			amountCentavos: 400000n, // 80% of 500000
			date: { microsSinceUnixEpoch: toMicros(thisMonth) },
		};
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([
				[{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null }],
				true,
			])
			.mockReturnValueOnce([
				[
					{
						id: 1n,
						ownerIdentity: null,
						tag: "grocery",
						allocatedCentavos: 500000n,
						updatedAt: null,
					},
				],
				true,
			])
			.mockReturnValueOnce([[mockTxn], true]);
		render(<BudgetPage />);
		const card = screen.getByTestId("tag-card-grocery");
		expect(card.className).toMatch(/bg-warning/);
	});

	it("renders error tint card when category is 100%+", () => {
		const mockTxn = {
			type: "expense",
			tag: "grocery",
			amountCentavos: 550000n, // 110% of 500000
			date: { microsSinceUnixEpoch: toMicros(thisMonth) },
		};
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([
				[{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null }],
				true,
			])
			.mockReturnValueOnce([
				[
					{
						id: 1n,
						ownerIdentity: null,
						tag: "grocery",
						allocatedCentavos: 500000n,
						updatedAt: null,
					},
				],
				true,
			])
			.mockReturnValueOnce([[mockTxn], true]);
		render(<BudgetPage />);
		const card = screen.getByTestId("tag-card-grocery");
		expect(card.className).toMatch(/bg-error/);
	});

	it('renders "no limit" for Others row when unallocated spending exists', () => {
		const mockTxn = {
			type: "expense",
			tag: "random",
			amountCentavos: 37900n,
			date: { microsSinceUnixEpoch: toMicros(thisMonth) },
		};
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([
				[{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null }],
				true,
			])
			.mockReturnValueOnce([[], true]) // no allocations
			.mockReturnValueOnce([[mockTxn], true]);
		render(<BudgetPage />);
		expect(screen.getByText(/no limit/i)).toBeInTheDocument();
	});

	it("clicking a tag card expands to show transactions for that tag", async () => {
		const mockTxns = [
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 150000n,
				description: "Weekend market",
				sourceSubAccountId: 1n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 270000n,
				description: "SM Supermarket",
				sourceSubAccountId: 1n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
			{
				type: "expense",
				tag: "foods",
				amountCentavos: 50000n,
				description: "Jollibee",
				sourceSubAccountId: 1n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
		];
		const budgetConfig = [
			{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null },
		];
		const allocs = [
			{ id: 1n, ownerIdentity: null, tag: "grocery", allocatedCentavos: 500000n, updatedAt: null },
		];
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockImplementation(() => {
			const idx = callCount % 3;
			callCount++;
			if (idx === 0) return [budgetConfig, true];
			if (idx === 1) return [allocs, true];
			return [mockTxns, true];
		});
		render(<BudgetPage />);
		// Transactions should not be visible initially
		expect(screen.queryByText("Weekend market")).not.toBeInTheDocument();
		// Click the grocery tag card
		await userEvent.click(screen.getByTestId("tag-card-grocery"));
		// Now grocery transactions should be visible
		expect(screen.getByText("Weekend market")).toBeInTheDocument();
		expect(screen.getByText("SM Supermarket")).toBeInTheDocument();
		// Foods transaction should NOT be visible (different tag)
		expect(screen.queryByText("Jollibee")).not.toBeInTheDocument();
	});

	it("clicking an expanded tag card collapses it", async () => {
		const mockTxns = [
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 150000n,
				description: "Weekend market",
				sourceSubAccountId: 1n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
		];
		const budgetConfig = [
			{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null },
		];
		const allocs = [
			{ id: 1n, ownerIdentity: null, tag: "grocery", allocatedCentavos: 500000n, updatedAt: null },
		];
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockImplementation(() => {
			const idx = callCount % 3;
			callCount++;
			if (idx === 0) return [budgetConfig, true];
			if (idx === 1) return [allocs, true];
			return [mockTxns, true];
		});
		render(<BudgetPage />);
		// Expand
		await userEvent.click(screen.getByTestId("tag-card-grocery"));
		expect(screen.getByText("Weekend market")).toBeInTheDocument();
		// Collapse
		await userEvent.click(screen.getByTestId("tag-card-grocery"));
		expect(screen.queryByText("Weekend market")).not.toBeInTheDocument();
	});

	it("renders budget vs actual bar chart when budget is configured", () => {
		const mockTxns = [
			{
				type: "expense",
				tag: "grocery",
				amountCentavos: 420000n,
				description: "Groceries",
				sourceSubAccountId: 1n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
		];
		(useTable as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce([
				[{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null }],
				true,
			])
			.mockReturnValueOnce([
				[
					{
						id: 1n,
						ownerIdentity: null,
						tag: "grocery",
						allocatedCentavos: 500000n,
						updatedAt: null,
					},
				],
				true,
			])
			.mockReturnValueOnce([mockTxns, true]);
		render(<BudgetPage />);
		expect(screen.getByTestId("budget-bar-chart")).toBeInTheDocument();
	});

	it("clicking Others card expands to show transactions for unallocated tags", async () => {
		const mockTxns = [
			{
				type: "expense",
				tag: "random-stuff",
				amountCentavos: 37900n,
				description: "Misc purchase",
				sourceSubAccountId: 1n,
				date: { microsSinceUnixEpoch: toMicros(thisMonth) },
			},
		];
		const budgetConfig = [
			{ id: 1n, ownerIdentity: null, totalCentavos: 2000000n, updatedAt: null },
		];
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockImplementation(() => {
			const idx = callCount % 3;
			callCount++;
			if (idx === 0) return [budgetConfig, true];
			if (idx === 1) return [[], true]; // no allocations
			return [mockTxns, true];
		});
		render(<BudgetPage />);
		expect(screen.queryByText("Misc purchase")).not.toBeInTheDocument();
		await userEvent.click(screen.getByTestId("tag-card-others"));
		expect(screen.getByText("Misc purchase")).toBeInTheDocument();
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

	// Helper: set up useTable mock for TransactionModal using mockImplementation
	// Call order on EACH render: (1) my_accounts, (2) my_sub_accounts, (3) my_budget_config, (4) my_budget_allocations, (5) my_transactions, (6) my_tag_configs
	// Using mockImplementation with a counter so each render cycle gets the right data
	function setupTransactionModalMocks(
		budgetConfig = mockBudgetConfig,
		allocations = mockAllocations,
		transactions = [mockTxnForHint],
	) {
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => {
			const idx = callCount % 6;
			callCount++;
			if (idx === 0) return [[], true]; // my_accounts
			if (idx === 1) return [[], true]; // my_sub_accounts
			if (idx === 2) return [budgetConfig, true]; // my_budget_config
			if (idx === 3) return [allocations, true]; // my_budget_allocations
			if (idx === 4) return [transactions, true]; // my_transactions
			return [[], true]; // my_tag_configs
		});
	}

	it("shows 'Budget remaining:' hint when type=expense and tag selected with allocation", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);
		// Default type is expense and default tag is "foods", need to select "grocery"
		await userEvent.selectOptions(screen.getByRole("combobox", { name: /tag/i }), "grocery");
		expect(screen.getByRole("status")).toHaveTextContent(/Budget remaining/);
	});

	it("shows '⚠ This will exceed' warning when entered amount exceeds allocation", async () => {
		// Allocation = 500000n (P5000), already spent = 490000n (P4900), remaining = 10000n (P100)
		const mockTxnAlmostOver = {
			type: "expense",
			tag: "grocery",
			amountCentavos: 490000n,
			date: { microsSinceUnixEpoch: BigInt(now.getTime()) * 1000n },
		};
		setupTransactionModalMocks(mockBudgetConfig, mockAllocations, [mockTxnAlmostOver]);
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);
		await userEvent.selectOptions(screen.getByRole("combobox", { name: /tag/i }), "grocery");
		// Enter P200 which exceeds remaining P100
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "200");
		expect(screen.getByRole("status")).toHaveTextContent(/⚠ This will exceed/);
	});

	it("hides budget hint entirely when transaction type is income", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);
		// Switch to income type
		await userEvent.click(screen.getByRole("button", { name: /income/i }));
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
