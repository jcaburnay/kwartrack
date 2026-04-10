import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebtCard } from "../components/DebtCard";
import { DebtModal } from "../components/DebtModal";
import { SettleModal } from "../components/SettleModal";
import { SplitCard } from "../components/SplitCard";
import { SplitModal } from "../components/SplitModal";

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

	it("renders Discard button that calls onClose", async () => {
		render(<DebtModal onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: /discard/i }));
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

	it("renders Discard button that calls onClose", async () => {
		render(<SplitModal onClose={onClose} />);
		await userEvent.click(screen.getByRole("button", { name: /discard/i }));
		expect(onClose).toHaveBeenCalledOnce();
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
