import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebtCard } from "../components/DebtCard";
import { DebtModal } from "../components/DebtModal";
import { SettleModal } from "../components/SettleModal";
import { SplitCard } from "../components/SplitCard";
import { SplitModal } from "../components/SplitModal";
import { DebtSplitPage } from "../pages/DebtSplitPage";
import { SplitDetailPage } from "../pages/SplitDetailPage";
import { getReducerSpy } from "./setup";

// File-wide table stub — earlier local vi.mock returned [[], false] so tests see
// the "not loading" path. Match that here before each test.
beforeEach(() => {
	vi.mocked(useTable).mockReturnValue([[], false]);
});

const mockCreateDebt = getReducerSpy("createDebt");

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

	it("submits createDebt for loaned direction with centavos, sub-account, and trimmed personName", async () => {
		vi.mocked(useTable).mockImplementation((table: unknown) => {
			const name = (table as { name?: string } | undefined)?.name;
			if (name === "my_accounts")
				return [[{ id: 10n, name: "BDO", isStandalone: false }], false] as never;
			if (name === "my_sub_accounts")
				return [
					[{ id: 99n, accountId: 10n, name: "Savings", isDefault: false, balanceCentavos: 0n }],
					false,
				] as never;
			return [[], false] as never;
		});
		const user = userEvent.setup();

		render(<DebtModal onClose={vi.fn()} />);

		await user.type(screen.getByLabelText(/Person/i), "  Juan  ");
		await user.type(screen.getByLabelText(/^Amount$/i), "150");
		await user.selectOptions(screen.getByLabelText(/Tag/i), "foods");
		await user.selectOptions(screen.getByLabelText(/Sub-account/i), "99");
		await user.click(screen.getByRole("button", { name: /Add debt/i }));

		await waitFor(() => expect(mockCreateDebt).toHaveBeenCalledTimes(1));
		expect(mockCreateDebt).toHaveBeenCalledWith(
			expect.objectContaining({
				personName: "Juan",
				direction: "loaned",
				amountCentavos: 15_000n,
				subAccountId: 99n,
				tag: "foods",
			}),
		);
	});

	it("submits createDebt for owed direction with subAccountId = 0n (no sub-account needed)", async () => {
		const user = userEvent.setup();
		render(<DebtModal onClose={vi.fn()} />);

		await user.click(screen.getByText(/I owe money/i));
		await user.type(screen.getByLabelText(/Person/i), "Maria");
		await user.type(screen.getByLabelText(/^Amount$/i), "42.50");
		await user.selectOptions(screen.getByLabelText(/Tag/i), "foods");
		await user.click(screen.getByRole("button", { name: /Add debt/i }));

		await waitFor(() => expect(mockCreateDebt).toHaveBeenCalledTimes(1));
		expect(mockCreateDebt).toHaveBeenCalledWith(
			expect.objectContaining({
				personName: "Maria",
				direction: "owed",
				amountCentavos: 4_250n,
				subAccountId: 0n,
			}),
		);
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

	it("submits settleDebt with debtId, centavos-converted amount, and selected sub-account", async () => {
		vi.mocked(useTable).mockImplementation((table: unknown) => {
			const name = (table as { name?: string } | undefined)?.name;
			if (name === "my_accounts")
				return [[{ id: 10n, name: "BDO", isStandalone: false }], false] as never;
			if (name === "my_sub_accounts")
				return [
					[{ id: 99n, accountId: 10n, name: "Savings", isDefault: false, balanceCentavos: 0n }],
					false,
				] as never;
			return [[], false] as never;
		});
		const spy = getReducerSpy("settleDebt");
		const user = userEvent.setup();

		render(<SettleModal debt={baseDebt} onClose={onClose} />);
		// Use the pre-filled remaining balance of ₱700.00 as the settlement amount;
		// just pick a sub-account and submit.
		await user.selectOptions(screen.getByLabelText(/Receive to/i), "99");
		await user.click(screen.getByRole("button", { name: /^Settle$/i }));

		await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
		expect(spy).toHaveBeenCalledWith({
			debtId: 1n,
			amountCentavos: 70_000n,
			subAccountId: 99n,
		});
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

	it("submits createSplit with equal-mode participants, centavos-converted total, and aligned share arrays", async () => {
		vi.mocked(useTable).mockImplementation((table: unknown) => {
			const name = (table as { name?: string } | undefined)?.name;
			if (name === "my_accounts")
				return [[{ id: 10n, name: "BDO", isStandalone: false }], false] as never;
			if (name === "my_sub_accounts")
				return [
					[{ id: 99n, accountId: 10n, name: "Savings", isDefault: false, balanceCentavos: 0n }],
					false,
				] as never;
			return [[], false] as never;
		});
		const spy = getReducerSpy("createSplit");
		const user = userEvent.setup();

		render(<SplitModal onClose={vi.fn()} />);

		await user.type(screen.getByLabelText(/Description/i), "Team lunch");
		await user.type(screen.getByLabelText(/Total amount/i), "300");
		await user.selectOptions(screen.getByLabelText(/^Tag$/i), "foods");
		await user.selectOptions(screen.getByLabelText(/Paid from/i), "99");
		// Add a second participant so we have two named friends alongside "you".
		await user.click(screen.getByText("+ Add person"));
		const nameInputs = screen.getAllByPlaceholderText("Name");
		await user.type(nameInputs[0], "Alice");
		await user.type(nameInputs[1], "Bob");
		await user.click(screen.getByRole("button", { name: /Create split/i }));

		await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
		const payload = spy.mock.calls[0][0] as {
			description: string;
			totalAmountCentavos: bigint;
			payerSubAccountId: bigint;
			splitMethod: string;
			tag: string;
			participantNames: string[];
			participantShares: bigint[];
			participantShareCounts: number[];
		};
		expect(payload.description).toBe("Team lunch");
		expect(payload.totalAmountCentavos).toBe(30_000n);
		expect(payload.payerSubAccountId).toBe(99n);
		expect(payload.splitMethod).toBe("equal");
		expect(payload.tag).toBe("foods");
		expect(payload.participantNames).toEqual(["Alice", "Bob"]);
		// Equal mode with 2 named + you = 3-way → ₱100 (10_000 centavos) each, BigInt floor.
		expect(payload.participantShares).toEqual([10_000n, 10_000n]);
		// participantShareCounts is all zeros outside "shares" mode.
		expect(payload.participantShareCounts).toEqual([0, 0]);
	});

	it("edit mode submits editSplit with splitEventId and preserves participantIds for existing participants", async () => {
		vi.mocked(useTable).mockImplementation((table: unknown) => {
			const name = (table as { name?: string } | undefined)?.name;
			if (name === "my_accounts")
				return [[{ id: 10n, name: "BDO", isStandalone: false }], false] as never;
			if (name === "my_sub_accounts")
				return [
					[{ id: 99n, accountId: 10n, name: "Savings", isDefault: false, balanceCentavos: 0n }],
					false,
				] as never;
			return [[], false] as never;
		});
		const createSpy = getReducerSpy("createSplit");
		const editSpy = getReducerSpy("editSplit");
		const user = userEvent.setup();

		const editTarget = {
			splitEvent: {
				id: 42n,
				description: "Team lunch",
				totalAmountCentavos: 30_000n,
				payerSubAccountId: 99n,
				tag: "foods",
				date: { microsSinceUnixEpoch: BigInt(new Date("2026-04-01").getTime()) * 1000n },
				splitMethod: "equal",
			},
			participants: [
				{ participantId: 7n, name: "Alice", shareAmountCentavos: 10_000n, shareCount: 1 },
				{ participantId: 8n, name: "Bob", shareAmountCentavos: 10_000n, shareCount: 1 },
			],
		};

		render(<SplitModal onClose={vi.fn()} editTarget={editTarget} />);
		// Submit unchanged — verifies the edit form round-trips existing participantIds.
		await user.click(screen.getByRole("button", { name: /Save changes/i }));

		await waitFor(() => expect(editSpy).toHaveBeenCalledTimes(1));
		expect(createSpy).not.toHaveBeenCalled();
		expect(editSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				splitEventId: 42n,
				splitMethod: "equal",
				totalAmountCentavos: 30_000n,
				payerSubAccountId: 99n,
				participantIds: [7n, 8n],
				participantNames: ["Alice", "Bob"],
			}),
		);
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
		render(
			<MemoryRouter>
				<SplitCard splitEvent={baseSplit} participants={baseParticipants} debts={[]} />
			</MemoryRouter>,
		);
		expect(screen.getByText("Dinner at Jollibee")).toBeInTheDocument();
	});

	it("shows total amount", () => {
		render(
			<MemoryRouter>
				<SplitCard splitEvent={baseSplit} participants={baseParticipants} debts={[]} />
			</MemoryRouter>,
		);
		expect(screen.getByText("P1,200.00")).toBeInTheDocument();
	});

	it("renders link to /splits/:id", () => {
		render(
			<MemoryRouter>
				<SplitCard
					splitEvent={{ ...baseSplit, id: 5n }}
					participants={baseParticipants}
					debts={[]}
				/>
			</MemoryRouter>,
		);
		const link = screen.getByRole("link");
		expect(link).toHaveAttribute("href", "/splits/5");
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

describe("SplitDetailPage", () => {
	const splitEvent = {
		id: 1n,
		description: "Dinner at Manam",
		totalAmountCentavos: 240000n,
		payerSubAccountId: 10n,
		tag: "foods",
		date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
		createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
		splitMethod: "equal",
	};
	const participants = [
		{
			id: 1n,
			splitEventId: 1n,
			personName: "Juan",
			shareAmountCentavos: 60000n,
			debtId: 10n,
			shareCount: 0,
		},
		{
			id: 2n,
			splitEventId: 1n,
			personName: "Maria",
			shareAmountCentavos: 60000n,
			debtId: 11n,
			shareCount: 0,
		},
	];
	const debts = [
		{
			id: 10n,
			personName: "Juan",
			direction: "loaned",
			amountCentavos: 60000n,
			settledAmountCentavos: 0n,
			tag: "foods",
			subAccountId: 10n,
			description: "",
			splitEventId: 1n,
			date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
			createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
		},
		{
			id: 11n,
			personName: "Maria",
			direction: "loaned",
			amountCentavos: 60000n,
			settledAmountCentavos: 60000n,
			tag: "foods",
			subAccountId: 10n,
			description: "",
			splitEventId: 1n,
			date: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
			createdAt: { microsSinceUnixEpoch: 1_700_000_000_000_000n },
		},
	];

	beforeEach(async () => {
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		(mockUseTable as ReturnType<typeof vi.fn>).mockImplementation((table: { name: string }) => {
			if (table?.name === "my_split_events") return [[splitEvent], true];
			if (table?.name === "my_split_participants") return [[...participants], true];
			if (table?.name === "my_debts") return [[...debts], true];
			if (table?.name === "my_sub_accounts")
				return [
					[{ id: 10n, accountId: 1n, name: "BPI Savings", isDefault: false, balanceCentavos: 0n }],
					true,
				];
			return [[], true];
		});
	});

	afterEach(async () => {
		const { useTable: mockUseTable } = await import("spacetimedb/react");
		(mockUseTable as ReturnType<typeof vi.fn>).mockImplementation(() => [[], false]);
	});

	function renderPage(id = "1") {
		return render(
			<MemoryRouter initialEntries={[`/splits/${id}`]}>
				<Routes>
					<Route path="/splits/:id" element={<SplitDetailPage />} />
				</Routes>
			</MemoryRouter>,
		);
	}

	it("renders split description", () => {
		renderPage();
		expect(screen.getByText("Dinner at Manam")).toBeInTheDocument();
	});

	it("renders participant names", () => {
		renderPage();
		expect(screen.getByText("Juan")).toBeInTheDocument();
		expect(screen.getByText("Maria")).toBeInTheDocument();
	});

	it("shows Settle button for unsettled participant", () => {
		renderPage();
		// Juan is unsettled — should have a Settle button
		const settleButtons = screen.getAllByRole("button", { name: /Settle/i });
		expect(settleButtons.length).toBeGreaterThanOrEqual(1);
	});

	it("shows settled badge for fully settled participant", () => {
		renderPage();
		// Maria is fully settled
		expect(screen.getByText("Settled")).toBeInTheDocument();
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
