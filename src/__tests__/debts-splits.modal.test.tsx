import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebtModal } from "../components/DebtModal";
import { SettleModal } from "../components/SettleModal";
import { SplitModal } from "../components/SplitModal";
import { getReducerSpy } from "./setup";

beforeEach(() => {
	vi.mocked(useTable).mockReturnValue([[], false]);
});

// Shared fixture: one account + one non-default sub-account so selects have options.
function mockAccountAndSubAccount() {
	vi.mocked(useTable).mockImplementation((table: unknown) => {
		const name = (table as { name?: string } | undefined)?.name;
		if (name === "my_accounts") {
			return [[{ id: 10n, name: "BDO", isStandalone: false }], false] as never;
		}
		if (name === "my_sub_accounts") {
			return [
				[{ id: 99n, accountId: 10n, name: "Savings", isDefault: false, balanceCentavos: 0n }],
				false,
			] as never;
		}
		return [[], false] as never;
	});
}

describe("DebtModal", () => {
	it("hides sub-account field when owed direction is selected", async () => {
		render(<DebtModal onClose={vi.fn()} />);
		expect(screen.getByLabelText("Source sub-account")).toBeInTheDocument();
		await userEvent.click(screen.getByText("I owe money"));
		expect(screen.queryByLabelText("Source sub-account")).not.toBeInTheDocument();
	});

	it("loaned: createDebt with centavos-converted amount, sub-account, trimmed personName", async () => {
		mockAccountAndSubAccount();
		const createDebt = getReducerSpy("createDebt");
		const user = userEvent.setup();

		render(<DebtModal onClose={vi.fn()} />);
		await user.type(screen.getByLabelText(/Person/i), "  Juan  ");
		await user.type(screen.getByLabelText(/^Amount$/i), "150");
		await user.selectOptions(screen.getByLabelText(/Tag/i), "foods");
		await user.selectOptions(screen.getByLabelText(/Sub-account/i), "99");
		await user.click(screen.getByRole("button", { name: /Add debt/i }));

		await waitFor(() => expect(createDebt).toHaveBeenCalledTimes(1));
		expect(createDebt).toHaveBeenCalledWith(
			expect.objectContaining({
				personName: "Juan",
				direction: "loaned",
				amountCentavos: 15_000n,
				subAccountId: 99n,
				tag: "foods",
			}),
		);
	});

	it("owed: createDebt with subAccountId = 0n (no sub-account selection)", async () => {
		const createDebt = getReducerSpy("createDebt");
		const user = userEvent.setup();

		render(<DebtModal onClose={vi.fn()} />);
		await user.click(screen.getByText(/I owe money/i));
		await user.type(screen.getByLabelText(/Person/i), "Maria");
		await user.type(screen.getByLabelText(/^Amount$/i), "42.50");
		await user.selectOptions(screen.getByLabelText(/Tag/i), "foods");
		await user.click(screen.getByRole("button", { name: /Add debt/i }));

		await waitFor(() => expect(createDebt).toHaveBeenCalledTimes(1));
		expect(createDebt).toHaveBeenCalledWith(
			expect.objectContaining({
				personName: "Maria",
				direction: "owed",
				amountCentavos: 4_250n,
				subAccountId: 0n,
			}),
		);
	});

	it("shows 'Date is required' when the date is cleared on submit", async () => {
		const user = userEvent.setup();
		render(<DebtModal onClose={vi.fn()} />);
		await user.clear(screen.getByLabelText(/^Date$/i));
		await user.click(screen.getByRole("button", { name: /Add debt/i }));
		expect(screen.getByText(/Date is required/i)).toBeInTheDocument();
	});
});

describe("SettleModal", () => {
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

	it("pre-fills settlement amount with remaining balance in pesos", () => {
		render(<SettleModal debt={baseDebt} onClose={vi.fn()} />);
		// (100_000 − 30_000) / 100 = ₱700
		expect(screen.getByLabelText("Settlement amount")).toHaveValue(700);
	});

	it("submits settleDebt with debtId, centavos-converted amount, and selected sub-account", async () => {
		mockAccountAndSubAccount();
		const settleDebt = getReducerSpy("settleDebt");
		const user = userEvent.setup();

		render(<SettleModal debt={baseDebt} onClose={vi.fn()} />);
		await user.selectOptions(screen.getByLabelText(/Receive to/i), "99");
		await user.click(screen.getByRole("button", { name: /^Settle$/i }));

		await waitFor(() => expect(settleDebt).toHaveBeenCalledTimes(1));
		expect(settleDebt).toHaveBeenCalledWith({
			debtId: 1n,
			amountCentavos: 70_000n,
			subAccountId: 99n,
		});
	});
});

describe("SplitModal", () => {
	it("clicking '+ Add person' appends a participant row", async () => {
		render(<SplitModal onClose={vi.fn()} />);
		await userEvent.click(screen.getByText("+ Add person"));
		const inputs = screen.getAllByPlaceholderText("Name");
		expect(inputs.length).toBeGreaterThanOrEqual(2);
	});

	it("equal mode: createSplit with centavos total, aligned share arrays, zero shareCounts", async () => {
		mockAccountAndSubAccount();
		const createSplit = getReducerSpy("createSplit");
		const user = userEvent.setup();

		render(<SplitModal onClose={vi.fn()} />);

		await user.type(screen.getByLabelText(/Description/i), "Team lunch");
		await user.type(screen.getByLabelText(/Total amount/i), "300");
		await user.selectOptions(screen.getByLabelText(/^Tag$/i), "foods");
		await user.selectOptions(screen.getByLabelText(/Paid from/i), "99");
		await user.click(screen.getByText("+ Add person"));
		const nameInputs = screen.getAllByPlaceholderText("Name");
		await user.type(nameInputs[0], "Alice");
		await user.type(nameInputs[1], "Bob");
		await user.click(screen.getByRole("button", { name: /Create split/i }));

		await waitFor(() => expect(createSplit).toHaveBeenCalledTimes(1));
		const payload = createSplit.mock.calls[0][0] as {
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
		// 2 named + you = 3-way, ₱100 (10,000 centavos) each with BigInt floor.
		expect(payload.participantShares).toEqual([10_000n, 10_000n]);
		// shareCounts stay zero outside "shares" mode.
		expect(payload.participantShareCounts).toEqual([0, 0]);
	});

	it("edit mode: editSplit with splitEventId and preserved participantIds", async () => {
		mockAccountAndSubAccount();
		const createSplit = getReducerSpy("createSplit");
		const editSplit = getReducerSpy("editSplit");
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
		await user.click(screen.getByRole("button", { name: /Save changes/i }));

		await waitFor(() => expect(editSplit).toHaveBeenCalledTimes(1));
		expect(createSplit).not.toHaveBeenCalled();
		expect(editSplit).toHaveBeenCalledWith(
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

	it("shows 'Date is required' when the date is cleared on submit", async () => {
		const user = userEvent.setup();
		render(<SplitModal onClose={vi.fn()} />);
		await user.clear(screen.getByLabelText(/^Date$/i));
		await user.click(screen.getByRole("button", { name: /Create split/i }));
		expect(screen.getByText(/Date is required/i)).toBeInTheDocument();
	});

	it("shows 'At least one participant' when all name inputs are blank", async () => {
		vi.mocked(useTable).mockImplementation((table: unknown) => {
			const name = (table as { name?: string } | undefined)?.name;
			if (name === "my_accounts") {
				return [[{ id: 1n, name: "BDO", isStandalone: true }], false] as never;
			}
			if (name === "my_sub_accounts") {
				return [
					[{ id: 10n, accountId: 1n, name: "__default__", isDefault: true, balanceCentavos: 0n }],
					false,
				] as never;
			}
			return [[], false] as never;
		});
		const user = userEvent.setup();
		render(<SplitModal onClose={vi.fn()} />);

		await user.type(screen.getByLabelText(/Description/i), "Team lunch");
		await user.type(screen.getByLabelText(/Amount/i), "500");
		await user.selectOptions(screen.getByLabelText(/Tag/i), ["foods"]);
		await user.selectOptions(screen.getByLabelText(/Paid from/i), ["10"]);
		// Leave the default participant name blank.
		await user.click(screen.getByRole("button", { name: /Create split/i }));

		expect(screen.getByText(/At least one participant/i)).toBeInTheDocument();
	});

	describe("method-specific participant inputs", () => {
		const cases: { method: string; placeholder: RegExp }[] = [
			{ method: "Exact", placeholder: /Amount/i },
			{ method: "%", placeholder: /%/i },
			{ method: "Shares", placeholder: /Shares/i },
		];
		for (const { method, placeholder } of cases) {
			it(`${method} mode renders a ${method.toLowerCase()} input per participant`, async () => {
				render(<SplitModal onClose={vi.fn()} />);
				await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${method}$`, "i") }));
				expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
			});
		}
	});
});
