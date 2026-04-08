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
					partitionId: 2n,
					dayOfMonth: 15,
					isPaused: false,
					remainingMonths: 0,
					totalMonths: 0,
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

	it('renders "Remaining months" input in installment mode', () => {
		render(<RecurringModal onClose={onClose} mode="installment" />);
		const input = screen.getByLabelText("Remaining months");
		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute("type", "number");
		expect(input).toHaveAttribute("max", "360");
	});

	it('hides "Remaining months" input in subscription mode', () => {
		render(<RecurringModal onClose={onClose} />);
		expect(screen.queryByLabelText("Remaining months")).not.toBeInTheDocument();
	});
});

describe("TransactionTable — ↻ badge", () => {
	const baseProps = {
		accounts: [],
		partitions: [],
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
			sourcePartitionId: 1n,
			destinationPartitionId: 0n,
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
			sourcePartitionId: 1n,
			destinationPartitionId: 0n,
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
		partitionId: 1n,
		dayOfMonth: 5,
		isPaused: false,
		remainingMonths: 8,
		totalMonths: 12,
	};

	it("shows installment counter when totalMonths > 0 and active", () => {
		render(<RecurringCard definition={baseDefinition} />);
		expect(screen.getByText("8 of 12 months")).toBeInTheDocument();
	});

	it('shows "X of Y months" counter when totalMonths > 0', () => {
		render(<RecurringCard definition={baseDefinition} />);
		expect(screen.getByText("8 of 12 months")).toBeInTheDocument();
	});

	it('shows "Completed" badge when remainingMonths=0 and isPaused', () => {
		render(
			<RecurringCard definition={{ ...baseDefinition, remainingMonths: 0, isPaused: true }} />,
		);
		expect(screen.getByText("Completed")).toBeInTheDocument();
		expect(screen.queryByText("INSTALLMENT")).not.toBeInTheDocument();
	});

	it('shows "0 of 12 months" for completed installments', () => {
		render(
			<RecurringCard definition={{ ...baseDefinition, remainingMonths: 0, isPaused: true }} />,
		);
		expect(screen.getByText("0 of 12 months")).toBeInTheDocument();
	});

	it("shows no installment info when totalMonths=0 (non-installment)", () => {
		render(
			<RecurringCard definition={{ ...baseDefinition, remainingMonths: 0, totalMonths: 0 }} />,
		);
		expect(screen.queryByText("INSTALLMENT")).not.toBeInTheDocument();
		expect(screen.queryByText("Completed")).not.toBeInTheDocument();
		expect(screen.queryByText(/of.*months/)).not.toBeInTheDocument();
	});
});
