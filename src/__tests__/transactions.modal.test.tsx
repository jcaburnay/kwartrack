import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "spacetimedb";
import { useTable } from "spacetimedb/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionModal } from "../components/TransactionModal";
import { getReducerSpy } from "./setup";

describe("TransactionModal field visibility by type", () => {
	it("expense shows From (hides To)", () => {
		render(<TransactionModal onClose={() => {}} />);
		expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Tag/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/From/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/^To$/i)).not.toBeInTheDocument();
	});

	it("income shows To (hides From)", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		await user.click(screen.getByRole("button", { name: /Income/i }));
		expect(screen.getByLabelText(/^To$/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/^From$/i)).not.toBeInTheDocument();
	});

	it("transfer shows From, To, and Service fee", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		await user.click(screen.getByRole("button", { name: /Transfer/i }));
		expect(screen.getByLabelText(/^From$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^To$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Service fee/i)).toBeInTheDocument();
	});
});

describe("TransactionModal tag behavior by type", () => {
	it("switching to transfer sets tag to the 'transfer' sentinel", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		expect(screen.getByDisplayValue("Select tag")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /Transfer/i }));
		expect(screen.getByRole("combobox", { name: /tag/i })).toHaveValue("transfer");
	});

	it("expense: 'Tag is required' when submitting without a tag", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		expect(screen.getByDisplayValue("Select tag")).toBeInTheDocument();
		await user.type(screen.getByLabelText(/Amount \(P\)/i), "100");
		await user.click(screen.getByRole("button", { name: /Save transaction/i }));
		expect(screen.getByText(/Tag is required/i)).toBeInTheDocument();
	});

	it("income: 'Tag is required' when tag is cleared back to placeholder", async () => {
		const user = userEvent.setup();
		render(<TransactionModal onClose={() => {}} />);
		await user.click(screen.getByRole("button", { name: /Income/i }));
		await user.selectOptions(screen.getByRole("combobox", { name: /Tag/i }), [""]);
		await user.type(screen.getByLabelText(/Amount \(P\)/i), "100");
		await user.click(screen.getByRole("button", { name: /Save transaction/i }));
		expect(screen.getByText(/Tag is required/i)).toBeInTheDocument();
	});
});

describe("TransactionModal edit mode pre-fill", () => {
	const existing = {
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

	it("pre-fills amount (in pesos) and description, and shows Update button", () => {
		render(<TransactionModal onClose={() => {}} transaction={existing} />);
		expect(screen.getByDisplayValue("5.00")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Weekly groceries")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Update transaction/i })).toBeInTheDocument();
	});
});

describe("TransactionModal reducer payloads", () => {
	const accounts = [
		{ id: 10n, name: "Maya", isStandalone: false },
		{ id: 20n, name: "GCash", isStandalone: false },
	];
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
			accountId: 20n,
			name: "Wallet",
			balanceCentavos: 0n,
			isDefault: false,
			subAccountType: "wallet",
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

	it("expense: centavos-converted amount, sourceSubAccountId set, destinationSubAccountId = 0n", async () => {
		mockTables();
		const createTransaction = getReducerSpy("createTransaction");
		const user = userEvent.setup();

		render(<TransactionModal onClose={vi.fn()} />);
		await user.type(screen.getByLabelText(/Amount \(P\)/i), "12.34");
		await user.selectOptions(screen.getByRole("combobox", { name: /Tag/i }), "foods");
		await user.selectOptions(screen.getByRole("combobox", { name: /^From$/i }), "1");
		await user.click(screen.getByRole("button", { name: /Save transaction/i }));

		await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
		expect(createTransaction).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "expense",
				amountCentavos: 1234n,
				tag: "foods",
				sourceSubAccountId: 1n,
				destinationSubAccountId: 0n,
				serviceFeeCentavos: 0n,
			}),
		);
	});

	it("income: sub-account routed onto destinationSubAccountId, source stays 0n", async () => {
		mockTables();
		const createTransaction = getReducerSpy("createTransaction");
		const user = userEvent.setup();

		render(<TransactionModal onClose={vi.fn()} />);
		await user.click(screen.getByRole("button", { name: /Income/i }));
		await user.type(screen.getByLabelText(/Amount \(P\)/i), "5000");
		await user.selectOptions(screen.getByRole("combobox", { name: /^To$/i }), "2");
		await user.click(screen.getByRole("button", { name: /Save transaction/i }));

		await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
		const call = createTransaction.mock.calls[0][0] as {
			type: string;
			amountCentavos: bigint;
			sourceSubAccountId: bigint;
			destinationSubAccountId: bigint;
		};
		expect(call.type).toBe("income");
		expect(call.amountCentavos).toBe(500_000n);
		expect(call.sourceSubAccountId).toBe(0n);
		expect(call.destinationSubAccountId).toBe(2n);
	});

	it("transfer: populates both endpoints and uses 'transfer' sentinel tag", async () => {
		mockTables();
		const createTransaction = getReducerSpy("createTransaction");
		const user = userEvent.setup();

		render(<TransactionModal onClose={vi.fn()} />);
		await user.click(screen.getByRole("button", { name: /Transfer/i }));
		await user.type(screen.getByLabelText(/Amount \(P\)/i), "100");
		await user.selectOptions(screen.getByRole("combobox", { name: /^From$/i }), "1");
		await user.selectOptions(screen.getByRole("combobox", { name: /^To$/i }), "2");
		await user.type(screen.getByLabelText(/Service fee/i), "5");
		await user.click(screen.getByRole("button", { name: /Save transaction/i }));

		await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
		expect(createTransaction).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "transfer",
				amountCentavos: 10_000n,
				tag: "transfer",
				sourceSubAccountId: 1n,
				destinationSubAccountId: 2n,
				serviceFeeCentavos: 500n,
			}),
		);
	});

	it("edit mode: calls editTransaction (not createTransaction) with transactionId", async () => {
		mockTables();
		const createTransaction = getReducerSpy("createTransaction");
		const editTransaction = getReducerSpy("editTransaction");
		const user = userEvent.setup();

		const existing = {
			id: 42n,
			type: "expense" as const,
			amountCentavos: 500n,
			tag: "foods",
			sourceSubAccountId: 1n,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: "Lunch",
			date: {
				microsSinceUnixEpoch: Timestamp.fromDate(new Date("2026-01-15")).microsSinceUnixEpoch,
			},
		};

		render(<TransactionModal onClose={vi.fn()} transaction={existing} />);
		const amount = screen.getByLabelText(/Amount \(P\)/i);
		await user.clear(amount);
		await user.type(amount, "7.50");
		await user.click(screen.getByRole("button", { name: /Update transaction/i }));

		await waitFor(() => expect(editTransaction).toHaveBeenCalledTimes(1));
		expect(createTransaction).not.toHaveBeenCalled();
		expect(editTransaction).toHaveBeenCalledWith(
			expect.objectContaining({
				transactionId: 42n,
				amountCentavos: 750n,
				sourceSubAccountId: 1n,
			}),
		);
	});
});

describe("TransactionModal default pre-fill", () => {
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

	it("defaultSourceSubAccountId pre-selects the source for a new expense", () => {
		mockTables();
		render(<TransactionModal onClose={() => {}} defaultSourceSubAccountId={2n} />);
		const fromSelect = screen.getByRole("combobox", { name: /^From$/i }) as HTMLSelectElement;
		expect(fromSelect.value).toBe("2");
	});

	it("defaultSourceSubAccountId is ignored in edit mode", () => {
		mockTables();
		const existing = {
			id: 42n,
			type: "expense" as const,
			amountCentavos: 500n,
			tag: "foods",
			sourceSubAccountId: 1n,
			destinationSubAccountId: 0n,
			serviceFeeCentavos: 0n,
			description: "",
			date: { microsSinceUnixEpoch: BigInt(new Date("2026-01-15").getTime()) * 1000n },
		};
		render(
			<TransactionModal onClose={() => {}} transaction={existing} defaultSourceSubAccountId={2n} />,
		);
		const fromSelect = screen.getByRole("combobox", { name: /^From$/i }) as HTMLSelectElement;
		expect(fromSelect.value).toBe("1");
	});
});
