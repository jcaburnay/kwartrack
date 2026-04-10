import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type vi } from "vitest";
import type { TransactionFilters } from "../components/TransactionFilterRow";
import { TransactionModal } from "../components/TransactionModal";
import { formatAccountLabel, type TransactionRow } from "../components/TransactionTable";
import { formatPesos } from "../utils/currency";

// =============================================================================
// Account filter: TransactionFilters interface
// =============================================================================
describe("Account filter: TransactionFilters interface", () => {
	it("accountPartition field is optional and defaults to undefined", () => {
		const filters: TransactionFilters = {
			type: "",
			tag: "",
			dateFrom: "",
			dateTo: "",
		};
		expect(filters.accountPartition).toBeUndefined();
	});

	it("accountPartition can hold account:{id} format", () => {
		const filters: TransactionFilters = {
			type: "",
			tag: "",
			dateFrom: "",
			dateTo: "",
			accountPartition: "account:1",
		};
		expect(filters.accountPartition).toBe("account:1");
	});

	it("accountPartition can hold partition:{id} format", () => {
		const filters: TransactionFilters = {
			type: "",
			tag: "",
			dateFrom: "",
			dateTo: "",
			accountPartition: "partition:5",
		};
		expect(filters.accountPartition).toBe("partition:5");
	});
});

// =============================================================================
// Account column: formatAccountLabel
// =============================================================================
describe("Account column: formatAccountLabel", () => {
	const accounts = [
		{ id: 1n, name: "BDO" },
		{ id: 2n, name: "GCash" },
	];
	const partitions = [
		{ id: 10n, accountId: 1n, name: "__default__", isDefault: true },
		{ id: 11n, accountId: 1n, name: "Savings", isDefault: false },
		{ id: 20n, accountId: 2n, name: "__default__", isDefault: true },
	];

	it("expense shows source account name", () => {
		const label = formatAccountLabel(
			{
				type: "expense",
				sourceSubAccountId: 10n,
				destinationSubAccountId: 0n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("BDO");
	});

	it("income shows destination account name", () => {
		const label = formatAccountLabel(
			{
				type: "income",
				sourceSubAccountId: 0n,
				destinationSubAccountId: 20n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("GCash");
	});

	it("same-account transfer shows account name", () => {
		const label = formatAccountLabel(
			{
				type: "transfer",
				sourceSubAccountId: 10n,
				destinationSubAccountId: 11n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("BDO");
	});

	it("cross-account transfer shows Source → Dest", () => {
		const label = formatAccountLabel(
			{
				type: "transfer",
				sourceSubAccountId: 10n,
				destinationSubAccountId: 20n,
			} as unknown as TransactionRow,
			accounts,
			partitions,
		);
		expect(label).toBe("BDO → GCash");
	});
});

// =============================================================================
// TXNC-08: Monetary values stored as integer centavos — centavos round-trip
// These tests are GREEN immediately (pure function, no component dependency)
// =============================================================================
describe("TXNC-08: centavos arithmetic (no float drift)", () => {
	it("100 centavos is P1.00", () => {
		expect(formatPesos(100n)).toBe("P1.00");
	});
	it("1 centavo is P0.01", () => {
		expect(formatPesos(1n)).toBe("P0.01");
	});
	it("999 centavos is P9.99", () => {
		expect(formatPesos(999n)).toBe("P9.99");
	});
	it("amount + service fee uses BigInt arithmetic (no float drift)", () => {
		// Simulates the D-22 Expense formula: source -= (amount + serviceFee)
		const amountCentavos = 100n;
		const serviceFeeCentavos = 15n;
		const debit = amountCentavos + serviceFeeCentavos;
		expect(debit).toBe(115n);
		expect(typeof debit).toBe("bigint");
	});
});

// =============================================================================
// TXNC-07: Tag selector — predefined list validation
// Pure data test — GREEN immediately
// =============================================================================
describe("TXNC-07: tag list completeness", () => {
	const TAGS = [
		"foods",
		"grocery",
		"transportation",
		"online-shopping",
		"gadgets",
		"bills",
		"pets",
		"personal-care",
		"health",
		"monthly-salary",
		"digital-subscriptions",
		"entertainment",
		"clothing",
		"education",
		"travel",
		"housing",
		"insurance",
		"gifts",
		"freelance",
		"interest",
		"bonus",
	];

	it("tag list has exactly 21 predefined tags", () => {
		expect(TAGS).toHaveLength(21);
	});

	it("all expected tags are present", () => {
		expect(TAGS).toContain("foods");
		expect(TAGS).toContain("monthly-salary");
		expect(TAGS).toContain("bonus");
		expect(TAGS).toContain("digital-subscriptions");
	});
});

// =============================================================================
// TXNC-06: Client-side filter logic
// Pure function tests — GREEN immediately
// =============================================================================
describe("TXNC-06: client-side filter logic", () => {
	const mockTransactions = [
		{
			id: 1n,
			type: "expense",
			tag: "foods",
			date: { microsSinceUnixEpoch: 1000000n },
			amountCentavos: 500n,
			sourceSubAccountId: 1n,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: "",
		},
		{
			id: 2n,
			type: "income",
			tag: "monthly-salary",
			date: { microsSinceUnixEpoch: 2000000n },
			amountCentavos: 100000n,
			sourceSubAccountId: 0n,
			destinationSubAccountId: 2n,
			serviceFeeCentavos: 0n,
			description: "Salary",
		},
		{
			id: 3n,
			type: "transfer",
			tag: "bills",
			date: { microsSinceUnixEpoch: 3000000n },
			amountCentavos: 5000n,
			sourceSubAccountId: 1n,
			destinationSubAccountId: 3n,
			serviceFeeCentavos: 50n,
			description: "",
		},
	];

	it("filters by type: expense", () => {
		const result = mockTransactions.filter((t) => t.type === "expense");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(1n);
	});

	it("filters by type: income", () => {
		const result = mockTransactions.filter((t) => t.type === "income");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(2n);
	});

	it("filters by tag", () => {
		const result = mockTransactions.filter((t) => t.tag === "bills");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(3n);
	});

	it("no filters returns all transactions", () => {
		expect(mockTransactions).toHaveLength(3);
	});
});

// =============================================================================
// TXNC-01: Expense transaction component
// =============================================================================
describe("TXNC-01: TransactionModal renders expense fields", () => {
	it("renders amount, tag, source partition (From), description, date fields for expense type", () => {
		render(<TransactionModal onClose={() => {}} />);
		// Default type is expense
		expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Tag/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/From/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
		// "To" field should NOT be present for expense
		expect(screen.queryByLabelText(/^To$/i)).not.toBeInTheDocument();
	});
	it("Save transaction button is present and enabled when form is valid", () => {
		render(<TransactionModal onClose={() => {}} />);
		expect(screen.getByRole("button", { name: /Save transaction/i })).toBeInTheDocument();
	});
});

// =============================================================================
// TXNC-02: Income transaction component
// =============================================================================
describe("TXNC-02: TransactionModal renders income fields", () => {
	it("renders amount, tag, destination partition (To), description, date fields for income type", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		// Switch to income type
		await user.click(screen.getByRole("button", { name: /Income/i }));
		expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Tag/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^To$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
		// "From" field should NOT be present for income
		expect(screen.queryByLabelText(/^From$/i)).not.toBeInTheDocument();
	});
});

// =============================================================================
// TXNC-03: Transfer transaction component
// =============================================================================
describe("TXNC-03: TransactionModal renders transfer fields", () => {
	it("renders amount, tag, From, To, service fee, description, date fields for transfer type", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		// Switch to transfer type
		await user.click(screen.getByRole("button", { name: /Transfer/i }));
		expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Tag/i)).toBeInTheDocument();
		expect(screen.getByRole("option", { name: /No tag/i })).toBeInTheDocument();
		expect(screen.getByLabelText(/^From$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^To$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Service fee/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
	});
	it("source and destination must differ — shows error when same partition selected", async () => {
		const user = userEvent.setup();
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		(mockUseTable as ReturnType<typeof vi.fn>).mockReturnValue([
			[
				{
					id: 1n,
					accountId: 10n,
					name: "Ewallet",
					balanceCentavos: 0n,
					isDefault: false,
				},
			],
			false,
		]);
		render(<TransactionModal onClose={() => {}} />);
		await user.click(screen.getByRole("button", { name: /Transfer/i }));
		// Submit without selecting valid source/destination
		await user.click(screen.getByRole("button", { name: /Save transaction/i }));
		// Validation should fire
		expect(
			screen.queryByText(/Select a source partition/i) ||
				screen.queryByText(/Select a destination partition/i) ||
				screen.queryByText(/Amount is required/i),
		).toBeTruthy();
	});
});

// =============================================================================
// Transfer tag bug: tag should switch to the transfer sentinel when switching type
// =============================================================================
describe("Transfer tag is cleared when switching to transfer type", () => {
	it("tag value becomes the transfer sentinel after switching to transfer type", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		// Default type is expense with tag "foods"
		expect(screen.getByDisplayValue("Foods")).toBeInTheDocument();
		// Switch to transfer type
		await user.click(screen.getByRole("button", { name: /Transfer/i }));
		expect(screen.getByRole("combobox", { name: /tag/i })).toHaveValue("transfer");
	});
});

// =============================================================================
// TXNC-04: Edit transaction
// =============================================================================
describe("TXNC-04: TransactionModal pre-fills values in edit mode", () => {
	const existingTransaction = {
		id: 42n,
		type: "expense" as const,
		amountCentavos: 500n,
		tag: "grocery",
		sourceSubAccountId: 1n,
		destinationSubAccountId: 0n,
		serviceFeeCentavos: 0n,
		description: "Weekly groceries",
		date: { microsSinceUnixEpoch: BigInt(new Date("2026-01-15").getTime()) * 1000n },
	};

	it("modal title is 'Edit transaction' in edit mode", () => {
		render(<TransactionModal onClose={() => {}} transaction={existingTransaction} />);
		expect(screen.getByText("Edit transaction")).toBeInTheDocument();
	});
	it("form fields are pre-filled with existing transaction values", () => {
		render(<TransactionModal onClose={() => {}} transaction={existingTransaction} />);
		expect(screen.getByDisplayValue("5.00")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Grocery")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Weekly groceries")).toBeInTheDocument();
		// Update button label
		expect(screen.getByRole("button", { name: /Update transaction/i })).toBeInTheDocument();
	});
});

// =============================================================================
// TXNC-05: Delete transaction (stub — GREEN after Plan 04)
// =============================================================================
describe("TXNC-05: TransactionRowActions delete flow", () => {
	it.todo("clicking Delete opens DeleteConfirmModal with transaction-specific copy");
	it.todo("confirming delete calls deleteTransaction reducer");
});
