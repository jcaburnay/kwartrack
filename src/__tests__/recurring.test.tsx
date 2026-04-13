import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurringCard } from "../components/RecurringCard";
import { RecurringModal } from "../components/RecurringModal";
import { TransactionTable } from "../components/TransactionTable";

// useReducer mock returns a vi.fn() — capture calls to verify reducer invocation
const mockCreateReducer = vi.fn();
vi.mock("spacetimedb/react", async (importOriginal) => {
	const original = await importOriginal<typeof import("spacetimedb/react")>();
	return {
		...original,
		useReducer: vi.fn((reducer) => {
			if (reducer?.accessorName === "createRecurringDefinition") return mockCreateReducer;
			return vi.fn();
		}),
		useTable: vi.fn(() => [[], false]),
	};
});

describe("RecurringModal", () => {
	const onClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders "New subscription" heading in subscription mode', () => {
		render(<RecurringModal onClose={onClose} />);
		expect(screen.getByText("New subscription")).toBeInTheDocument();
	});

	it('renders "New installment" heading in installment mode', () => {
		render(<RecurringModal onClose={onClose} mode="installment" />);
		expect(screen.getByText("New installment")).toBeInTheDocument();
	});

	it('renders "Edit recurring transaction" heading in edit mode', () => {
		render(
			<RecurringModal
				onClose={onClose}
				definition={{
					id: 1n,
					name: "Netflix",
					type: "expense",
					amountCentavos: 79900n,
					tag: "digital-subscriptions",
					subAccountId: 2n,
					dayOfMonth: 15,
					interval: "monthly",
					anchorMonth: 0,
					anchorDayOfWeek: 0,
					isPaused: false,
					remainingOccurrences: 0,
					totalOccurrences: 0,
				}}
			/>,
		);
		expect(screen.getByText("Edit recurring transaction")).toBeInTheDocument();
	});

	it("day-of-month select has exactly 28 options (1–28)", () => {
		render(<RecurringModal onClose={onClose} />);
		const select = screen.getByLabelText(/day of month/i);
		const options = select.querySelectorAll("option");
		// Options 1–28 = 28 options (no 29, 30, 31)
		expect(options).toHaveLength(28);
		expect(Array.from(options).map((o) => (o as HTMLOptionElement).value)).not.toContain("29");
		expect(Array.from(options).map((o) => (o as HTMLOptionElement).value)).not.toContain("31");
	});

	it('renders "Discard" button that calls onClose', async () => {
		render(<RecurringModal onClose={onClose} />);
		const discard = screen.getByRole("button", { name: /discard/i });
		await userEvent.click(discard);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('renders "Remaining occurrences" input in installment mode', () => {
		render(<RecurringModal onClose={onClose} mode="installment" />);
		const input = screen.getByLabelText("Remaining occurrences");
		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute("type", "number");
		expect(input).toHaveAttribute("max", "360");
	});

	it('hides "Remaining occurrences" input in subscription mode', () => {
		render(<RecurringModal onClose={onClose} />);
		expect(screen.queryByLabelText("Remaining occurrences")).not.toBeInTheDocument();
	});

	it("renders interval dropdown with 6 options", () => {
		render(<RecurringModal onClose={onClose} />);
		const select = screen.getByLabelText(/interval/i);
		const options = select.querySelectorAll("option");
		expect(options).toHaveLength(6);
		const values = Array.from(options).map((o) => (o as HTMLOptionElement).value);
		expect(values).toContain("weekly");
		expect(values).toContain("biweekly");
		expect(values).toContain("monthly");
		expect(values).toContain("quarterly");
		expect(values).toContain("semiannual");
		expect(values).toContain("yearly");
	});

	it('defaults interval to "monthly" in new subscription mode', () => {
		render(<RecurringModal onClose={onClose} />);
		const select = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		expect(select.value).toBe("monthly");
	});

	it("shows month picker when interval is semiannual", async () => {
		render(<RecurringModal onClose={onClose} />);
		const intervalSelect = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		await userEvent.selectOptions(intervalSelect, "semiannual");
		expect(screen.getByLabelText(/anchor month/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/day of week/i)).not.toBeInTheDocument();
	});

	it("shows month picker when interval is yearly", async () => {
		render(<RecurringModal onClose={onClose} />);
		const intervalSelect = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		await userEvent.selectOptions(intervalSelect, "yearly");
		expect(screen.getByLabelText(/anchor month/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/day of week/i)).not.toBeInTheDocument();
	});

	it("shows day-of-week picker and hides day-of-month when interval is weekly", async () => {
		render(<RecurringModal onClose={onClose} />);
		const intervalSelect = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		await userEvent.selectOptions(intervalSelect, "weekly");
		expect(screen.getByLabelText(/day of week/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/day of month/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/anchor month/i)).not.toBeInTheDocument();
	});

	it("shows day-of-week picker and hides day-of-month when interval is biweekly", async () => {
		render(<RecurringModal onClose={onClose} />);
		const intervalSelect = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		await userEvent.selectOptions(intervalSelect, "biweekly");
		expect(screen.getByLabelText(/day of week/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/day of month/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/anchor month/i)).not.toBeInTheDocument();
	});

	it("shows only day-of-month when interval is monthly", async () => {
		render(<RecurringModal onClose={onClose} />);
		const intervalSelect = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		await userEvent.selectOptions(intervalSelect, "monthly");
		expect(screen.getByLabelText(/day of month/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/anchor month/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/day of week/i)).not.toBeInTheDocument();
	});
});

describe("TransactionTable — ↻ badge", () => {
	const baseProps = {
		accounts: [],
		subAccounts: [],
		hasActiveFilters: false,
		onEdit: vi.fn(),
		onDelete: vi.fn(),
		onAddNew: vi.fn(),
	};

	it("renders ↻ prefix when isRecurring is true", () => {
		const txn = {
			id: 1n,
			type: "expense",
			amountCentavos: 300000n,
			tag: "bills",
			sourceSubAccountId: 1n,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: "",
			date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
			isRecurring: true,
			recurringDefinitionId: 5n,
		};
		render(<TransactionTable {...baseProps} transactions={[txn]} />);
		expect(screen.getByTitle("Auto-created recurring transaction")).toBeInTheDocument();
	});

	it("does NOT render ↻ when isRecurring is false", () => {
		const txn = {
			id: 2n,
			type: "expense",
			amountCentavos: 100000n,
			tag: "foods",
			sourceSubAccountId: 1n,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: "",
			date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
			isRecurring: false,
			recurringDefinitionId: 0n,
		};
		render(<TransactionTable {...baseProps} transactions={[txn]} />);
		expect(screen.queryByTitle("Auto-created recurring transaction")).not.toBeInTheDocument();
	});
});

describe("RecurringCard — installment display", () => {
	const baseDefinition = {
		id: 10n,
		name: "Car Loan",
		type: "expense" as const,
		amountCentavos: 1500000n,
		tag: "bills",
		subAccountId: 1n,
		dayOfMonth: 5,
		interval: "monthly",
		anchorMonth: 0,
		anchorDayOfWeek: 0,
		isPaused: false,
		remainingOccurrences: 8,
		totalOccurrences: 12,
	};

	it("shows installment counter when totalMonths > 0 and active", () => {
		render(<RecurringCard definition={baseDefinition} />);
		expect(screen.getByText("8 of 12 payments")).toBeInTheDocument();
	});

	it('shows "X of Y months" counter when totalMonths > 0', () => {
		render(<RecurringCard definition={baseDefinition} />);
		expect(screen.getByText("8 of 12 payments")).toBeInTheDocument();
	});

	it('shows "Completed" badge when remainingOccurrences=0 and isPaused', () => {
		render(
			<RecurringCard definition={{ ...baseDefinition, remainingOccurrences: 0, isPaused: true }} />,
		);
		expect(screen.getByText("Completed")).toBeInTheDocument();
		expect(screen.queryByText("INSTALLMENT")).not.toBeInTheDocument();
	});

	it('shows "0 of 12 payments" for completed installments', () => {
		render(
			<RecurringCard definition={{ ...baseDefinition, remainingOccurrences: 0, isPaused: true }} />,
		);
		expect(screen.getByText("0 of 12 payments")).toBeInTheDocument();
	});

	it("shows no installment info when totalOccurrences=0 (non-installment)", () => {
		render(
			<RecurringCard
				definition={{ ...baseDefinition, remainingOccurrences: 0, totalOccurrences: 0 }}
			/>,
		);
		expect(screen.queryByText("INSTALLMENT")).not.toBeInTheDocument();
		expect(screen.queryByText("Completed")).not.toBeInTheDocument();
		expect(screen.queryByText(/of.*payments/)).not.toBeInTheDocument();
	});

	it("shows interval badge on the card", () => {
		render(<RecurringCard definition={baseDefinition} />);
		expect(screen.getByText("monthly")).toBeInTheDocument();
	});

	it("shows correct interval badge for yearly", () => {
		render(<RecurringCard definition={{ ...baseDefinition, interval: "yearly" }} />);
		expect(screen.getByText("yearly")).toBeInTheDocument();
	});
});
