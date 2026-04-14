import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebtCard } from "../components/DebtCard";
import { DebtModal } from "../components/DebtModal";
import { SettleModal } from "../components/SettleModal";
import { SplitCard } from "../components/SplitCard";
import { SplitModal } from "../components/SplitModal";
import { DebtSplitPage } from "../pages/DebtSplitPage";

const mockCreateDebt = vi.fn();
vi.mock("spacetimedb/react", async (importOriginal) => {
	const original = await importOriginal<typeof import("spacetimedb/react")>();
	return {
		...original,
		useReducer: vi.fn((reducer) => {
			if (reducer?.accessorName === "createDebt") return mockCreateDebt;
			return vi.fn();
		}),
		useTable: vi.fn(() => [[], false]),
	};
});

describe("DebtModal", () => {
	const onClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders "New debt" heading', () => {
		render(<DebtModal onClose={onClose} />);
		expect(screen.getByText("New debt")).toBeInTheDocument();
	});

	it('shows "I lent money" and "I owe money" direction options', () => {
		render(<DebtModal onClose={onClose} />);
		expect(screen.getByText("I lent money")).toBeInTheDocument();
		expect(screen.getByText("I owe money")).toBeInTheDocument();
	});

	it("shows sub-account field for loaned direction", () => {
		render(<DebtModal onClose={onClose} />);
		expect(screen.getByLabelText("Source sub-account")).toBeInTheDocument();
	});

	it("hides sub-account field when owed direction selected", async () => {
		render(<DebtModal onClose={onClose} />);
		await userEvent.click(screen.getByText("I owe money"));
		expect(screen.queryByLabelText("Source sub-account")).not.toBeInTheDocument();
	});

	it("renders Cancel button that calls onClose", async () => {
		render(<DebtModal onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalledOnce();
	});
});

describe("SettleModal", () => {
	const onClose = vi.fn();
	const baseDebt = {
		id: 1n,
		personName: "Juan",
		direction: "loaned" as const,
		amountCentavos: 100000n,
		settledAmountCentavos: 30000n,
		tag: "foods",
		subAccountId: 1n,
		description: "",
		splitEventId: 0n,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders settle heading with person name", () => {
		render(<SettleModal debt={baseDebt} onClose={onClose} />);
		expect(screen.getByText(/Settle.*Juan/)).toBeInTheDocument();
	});

	it("pre-fills amount with remaining balance", () => {
		render(<SettleModal debt={baseDebt} onClose={onClose} />);
		const input = screen.getByLabelText("Settlement amount");
		expect(input).toHaveValue(700); // (100000 - 30000) / 100
	});

	it("renders Cancel button that calls onClose", async () => {
		render(<SettleModal debt={baseDebt} onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalledOnce();
	});
});

describe("SplitModal", () => {
	const onClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders "New split" heading', () => {
		render(<SplitModal onClose={onClose} />);
		expect(screen.getByText("New split")).toBeInTheDocument();
	});

	it('shows "+ Add person" button', () => {
		render(<SplitModal onClose={onClose} />);
		expect(screen.getByText("+ Add person")).toBeInTheDocument();
	});

	it("adds a participant row when clicking Add person", async () => {
		render(<SplitModal onClose={onClose} />);
		await userEvent.click(screen.getByText("+ Add person"));
		const inputs = screen.getAllByPlaceholderText("Name");
		expect(inputs.length).toBeGreaterThanOrEqual(2); // 1 default + 1 added
	});

	it("renders Cancel button that calls onClose", async () => {
		render(<SplitModal onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalledOnce();
	});
});

// =============================================================================
// DebtModal: date field validation display
// =============================================================================
describe("DebtModal: shows date validation error", () => {
	it("shows 'Date is required' when date is cleared and form is submitted", async () => {
		const user = userEvent.setup();
		render(<DebtModal onClose={vi.fn()} />);
		await user.clear(screen.getByLabelText(/^Date$/i));
		await user.click(screen.getByRole("button", { name: /Add debt/i }));
		expect(screen.getByText(/Date is required/i)).toBeInTheDocument();
	});
});

// =============================================================================
// SplitModal: date field validation display + participants validation
// =============================================================================
describe("SplitModal: shows date validation error", () => {
	it("shows 'Date is required' when date is cleared and form is submitted", async () => {
		const user = userEvent.setup();
		render(<SplitModal onClose={vi.fn()} />);
		await user.clear(screen.getByLabelText(/^Date$/i));
		await user.click(screen.getByRole("button", { name: /Create split/i }));
		expect(screen.getByText(/Date is required/i)).toBeInTheDocument();
	});
});

describe("SplitModal: participants required validation", () => {
	it("shows error when all participant name inputs are blank", async () => {
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		// Persist across re-renders by using mockImplementation keyed on table name
		(mockUseTable as ReturnType<typeof vi.fn>).mockImplementation((table: { name: string }) => {
			if (table?.name === "my_accounts")
				return [[{ id: 1n, name: "BDO", isStandalone: true }], false];
			if (table?.name === "my_sub_accounts")
				return [
					[{ id: 10n, accountId: 1n, name: "__default__", isDefault: true, balanceCentavos: 0n }],
					false,
				];
			return [[], false];
		});

		const user = userEvent.setup();
		render(<SplitModal onClose={vi.fn()} />);

		// Fill all required react-hook-form fields
		await user.type(screen.getByLabelText(/Description/i), "Team lunch");
		await user.type(screen.getByLabelText(/Amount/i), "500");
		await user.selectOptions(screen.getByLabelText(/Tag/i), ["foods"]);
		await user.selectOptions(screen.getByLabelText(/Paid from/i), ["10"]);
		// Leave the single participant name input blank (default state)
		await user.click(screen.getByRole("button", { name: /Create split/i }));

		expect(screen.getByText(/At least one participant/i)).toBeInTheDocument();
	});

	afterEach(async () => {
		// Restore default so subsequent tests are not affected
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		(mockUseTable as ReturnType<typeof vi.fn>).mockImplementation(() => [[], false]);
	});
});

describe("DebtCard", () => {
	const baseDebts = [
		{
			id: 1n,
			personName: "Juan",
			direction: "loaned",
			amountCentavos: 100000n,
			subAccountId: 1n,
			settledAmountCentavos: 30000n,
			tag: "foods",
			description: "",
			date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
			splitEventId: 0n,
			createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
		},
	];

	it("renders person name", () => {
		render(<DebtCard personName="Juan" debts={baseDebts} />);
		expect(screen.getByText("Juan")).toBeInTheDocument();
	});

	it("shows loaned direction badge", () => {
		render(<DebtCard personName="Juan" debts={baseDebts} />);
		expect(screen.getByText("LOANED")).toBeInTheDocument();
	});

	it("shows net balance", () => {
		render(<DebtCard personName="Juan" debts={baseDebts} />);
		expect(screen.getByText(/owes you/)).toBeInTheDocument();
	});
});

describe("SplitCard", () => {
	const baseSplit = {
		id: 1n,
		description: "Dinner at Jollibee",
		totalAmountCentavos: 120000n,
		payerSubAccountId: 1n,
		tag: "foods",
		date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
		createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
	};

	const baseParticipants = [
		{
			id: 1n,
			splitEventId: 1n,
			personName: "Juan",
			shareAmountCentavos: 30000n,
			debtId: 10n,
		},
		{
			id: 2n,
			splitEventId: 1n,
			personName: "Maria",
			shareAmountCentavos: 30000n,
			debtId: 11n,
		},
	];

	it("renders split description", () => {
		render(<SplitCard splitEvent={baseSplit} participants={baseParticipants} debts={[]} />);
		expect(screen.getByText("Dinner at Jollibee")).toBeInTheDocument();
	});

	it("shows total amount", () => {
		render(<SplitCard splitEvent={baseSplit} participants={baseParticipants} debts={[]} />);
		expect(screen.getByText("P1,200.00")).toBeInTheDocument();
	});
});

describe("SplitModal: split method tabs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders Equal, Exact, %, Shares method tabs", () => {
		render(<SplitModal onClose={vi.fn()} />);
		expect(screen.getByRole("button", { name: /^Equal$/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Exact$/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^%$/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Shares$/i })).toBeInTheDocument();
	});

	it("shows amount input per participant in Exact mode", async () => {
		render(<SplitModal onClose={vi.fn()} />);
		await userEvent.click(screen.getByRole("button", { name: /^Exact$/i }));
		expect(screen.getByPlaceholderText(/Amount/i)).toBeInTheDocument();
	});

	it("shows % input per participant in Percentage mode", async () => {
		render(<SplitModal onClose={vi.fn()} />);
		await userEvent.click(screen.getByRole("button", { name: /^%$/i }));
		expect(screen.getByPlaceholderText(/%/i)).toBeInTheDocument();
	});

	it("shows share count stepper per participant in Shares mode", async () => {
		render(<SplitModal onClose={vi.fn()} />);
		await userEvent.click(screen.getByRole("button", { name: /^Shares$/i }));
		expect(screen.getByPlaceholderText(/Shares/i)).toBeInTheDocument();
	});
});

describe("SplitModal: edit mode", () => {
	const editTarget = {
		splitEvent: {
			id: 1n,
			description: "Dinner",
			totalAmountCentavos: 120000n,
			payerSubAccountId: 10n,
			tag: "foods",
			date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
			splitMethod: "equal",
		},
		participants: [{ participantId: 1n, name: "Juan", shareAmountCentavos: 40000n, shareCount: 0 }],
	};

	it("shows Edit split heading in edit mode", () => {
		render(<SplitModal onClose={vi.fn()} editTarget={editTarget} />);
		expect(screen.getByText("Edit split")).toBeInTheDocument();
	});

	it("pre-fills description in edit mode", () => {
		render(<SplitModal onClose={vi.fn()} editTarget={editTarget} />);
		expect(screen.getByLabelText(/Description/i)).toHaveValue("Dinner");
	});
});

describe("DebtSplitPage: balance summary strip", () => {
	beforeEach(async () => {
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		(mockUseTable as ReturnType<typeof vi.fn>).mockImplementation((table: { name: string }) => {
			if (table?.name === "my_debts")
				return [
					[
						{
							id: 1n,
							personName: "Juan",
							direction: "loaned",
							amountCentavos: 100000n,
							settledAmountCentavos: 20000n,
							tag: "foods",
							subAccountId: 1n,
							description: "",
							splitEventId: 0n,
							date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
							createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
						},
						{
							id: 2n,
							personName: "Maria",
							direction: "owed",
							amountCentavos: 50000n,
							settledAmountCentavos: 0n,
							tag: "foods",
							subAccountId: 0n,
							description: "",
							splitEventId: 0n,
							date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
							createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
						},
					],
					true,
				];
			return [[], true];
		});
	});

	afterEach(async () => {
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		(mockUseTable as ReturnType<typeof vi.fn>).mockImplementation(() => [[], false]);
	});

	it("shows You're owed total from loaned debts", () => {
		render(
			<MemoryRouter>
				<DebtSplitPage />
			</MemoryRouter>,
		);
		// loaned: 100000 - 20000 = 80000 centavos = ₱800.00
		const strip = screen.getByTestId("balance-strip");
		expect(within(strip).getByText(/You're owed/i)).toBeInTheDocument();
		expect(within(strip).getByText(/P800\.00/)).toBeInTheDocument();
	});

	it("shows You owe total from owed debts", () => {
		render(
			<MemoryRouter>
				<DebtSplitPage />
			</MemoryRouter>,
		);
		// owed: 50000 centavos = ₱500.00
		const strip = screen.getByTestId("balance-strip");
		expect(within(strip).getByText(/You owe/i)).toBeInTheDocument();
		expect(within(strip).getByText(/P500\.00/)).toBeInTheDocument();
	});
});
