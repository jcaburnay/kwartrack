import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPesos } from "../utils/currency";

// ============================================================================
// Fixture data — matches the Phase 6 schema (added in Plan 02)
// ============================================================================

const creditPartition = {
	id: 1n,
	accountId: 1n,
	name: "RCBC/Credit",
	balanceCentavos: 620000n, // P6,200 outstanding
	isDefault: false,
	createdAt: { microsSinceUnixEpoch: 0n },
	partitionType: "credit",
	creditLimitCentavos: 12000000n, // P120,000 limit
};

const walletPartition = {
	id: 2n,
	accountId: 1n,
	name: "RCBC/Savings",
	balanceCentavos: 5000000n,
	isDefault: false,
	createdAt: { microsSinceUnixEpoch: 0n },
	partitionType: "wallet",
	creditLimitCentavos: 0n,
};

const mockAccount = {
	id: 1n,
	name: "RCBC",
	isStandalone: false,
	ownerIdentity: null,
};

// ============================================================================
// formatPesos sanity check — verifies the format used in credit display
// ============================================================================

describe("formatPesos credit amounts", () => {
	it("formats 620000 centavos as P6,200.00", () => {
		expect(formatPesos(620000n)).toBe("P6,200.00");
	});

	it("formats 12000000 centavos as P120,000.00", () => {
		expect(formatPesos(12000000n)).toBe("P120,000.00");
	});
});

// ============================================================================
// CRDT-04: PartitionCard credit variant
// ============================================================================

describe("PartitionCard credit variant", () => {
	it("renders available credit and limit for credit partition", async () => {
		const { PartitionCard } = await import("../components/PartitionCard");
		render(
			<PartitionCard
				id={creditPartition.id}
				name={creditPartition.name}
				balanceCentavos={creditPartition.balanceCentavos}
				partitionType={creditPartition.partitionType}
				creditLimitCentavos={creditPartition.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		// Available = 12000000 - 620000 = 11380000 centavos = P113,800.00
		expect(screen.getByText(/P113,800/)).toBeInTheDocument();
		expect(screen.getByText(/P120,000/)).toBeInTheDocument();
	});

	it("shows available percentage for credit partition", async () => {
		const { PartitionCard } = await import("../components/PartitionCard");
		render(
			<PartitionCard
				id={creditPartition.id}
				name={creditPartition.name}
				balanceCentavos={creditPartition.balanceCentavos}
				partitionType={creditPartition.partitionType}
				creditLimitCentavos={creditPartition.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		// 95% available
		expect(screen.getByText(/95% available/)).toBeInTheDocument();
	});

	it("renders Edit option in dropdown for credit partition", async () => {
		const { PartitionCard } = await import("../components/PartitionCard");
		render(
			<PartitionCard
				id={creditPartition.id}
				name={creditPartition.name}
				balanceCentavos={creditPartition.balanceCentavos}
				partitionType={creditPartition.partitionType}
				creditLimitCentavos={creditPartition.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		expect(screen.getByRole("button", { name: /^Edit$/ })).toBeInTheDocument();
	});

	it("renders CREDIT badge for credit partition", async () => {
		const { PartitionCard } = await import("../components/PartitionCard");
		render(
			<PartitionCard
				id={creditPartition.id}
				name={creditPartition.name}
				balanceCentavos={creditPartition.balanceCentavos}
				partitionType={creditPartition.partitionType}
				creditLimitCentavos={creditPartition.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		expect(screen.getByText("CREDIT")).toBeInTheDocument();
	});

	it("renders Pay Credit button for credit partition", async () => {
		const { PartitionCard } = await import("../components/PartitionCard");
		render(
			<PartitionCard
				id={creditPartition.id}
				name={creditPartition.name}
				balanceCentavos={creditPartition.balanceCentavos}
				partitionType={creditPartition.partitionType}
				creditLimitCentavos={creditPartition.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
				onEdit={vi.fn()}
			/>,
		);
		expect(screen.getByRole("button", { name: /Pay Credit/i })).toBeInTheDocument();
	});

	it("does NOT render CREDIT badge for wallet partition", async () => {
		const { PartitionCard } = await import("../components/PartitionCard");
		render(
			<PartitionCard
				id={walletPartition.id}
				name={walletPartition.name}
				balanceCentavos={walletPartition.balanceCentavos}
				partitionType={walletPartition.partitionType}
				creditLimitCentavos={walletPartition.creditLimitCentavos}
				onDeleteRequest={vi.fn()}
				onPayCredit={vi.fn()}
			/>,
		);
		expect(screen.queryByText("CREDIT")).toBeNull();
	});
});

// ============================================================================
// CRDT-01: PartitionModal credit fields
// ============================================================================

describe("PartitionModal credit fields", () => {
	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[walletPartition], true]);
	});

	it("renders Partition type select with Credit option", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(<PartitionModal accountId={1n} isStandalone={false} onClose={vi.fn()} />);
		// The modal should render a partition type selector
		const typeSelect = screen.getByLabelText(/Partition type/i);
		expect(typeSelect).toBeInTheDocument();
		// Credit option must exist in the select
		expect(screen.getByRole("option", { name: /Credit/i })).toBeInTheDocument();
	});

	it("shows credit limit field when type=credit selected", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(<PartitionModal accountId={1n} isStandalone={false} onClose={vi.fn()} />);
		const typeSelect = screen.getByLabelText(/Partition type/i);
		// Select credit type
		await userEvent.selectOptions(typeSelect, "credit");
		// Credit limit input should appear
		expect(screen.getByLabelText(/Credit limit/i)).toBeInTheDocument();
	});

	it("hides credit limit field for non-credit types", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(<PartitionModal accountId={1n} isStandalone={false} onClose={vi.fn()} />);
		// Default type should be wallet — no credit limit field
		expect(screen.queryByLabelText(/Credit limit/i)).toBeNull();
	});
});

// ============================================================================
// CRDT-02: TransactionModal credit hint
// ============================================================================

describe("TransactionModal credit hint", () => {
	// useTable call order in TransactionModal:
	// (1) my_accounts, (2) my_partitions, (3) my_budget_config, (4) my_budget_allocations, (5) my_transactions, (6) my_tag_configs
	function setupTransactionModalMocks() {
		let callCount = 0;
		(useTable as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => {
			const idx = callCount % 6;
			callCount++;
			if (idx === 0) return [[mockAccount], true]; // my_accounts
			if (idx === 1) return [[creditPartition, walletPartition], true]; // my_partitions
			if (idx === 2) return [[], true]; // my_budget_config
			if (idx === 3) return [[], true]; // my_budget_allocations
			if (idx === 4) return [[], true]; // my_transactions
			return [[], true]; // my_tag_configs
		});
	}

	it("shows credit available hint when credit partition selected as expense source", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);

		// Select credit partition from the source dropdown (expense mode is default)
		const sourceSelect = screen.getByRole("combobox", { name: /from/i });
		await userEvent.selectOptions(sourceSelect, creditPartition.id.toString());

		// Enter an amount well under the limit
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "100");

		// Credit hint should appear
		expect(screen.getByText(/Credit available/i)).toBeInTheDocument();
	});

	it("shows over-limit warning when amount exceeds available credit", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);

		// Select credit partition
		const sourceSelect = screen.getByRole("combobox", { name: /from/i });
		await userEvent.selectOptions(sourceSelect, creditPartition.id.toString());

		// Available credit = 120000 - 6200 = 113800
		// Enter P114200 which exceeds available P113,800 by P400
		await userEvent.type(screen.getByRole("spinbutton", { name: /amount/i }), "114200");

		// Over-limit warning should appear
		expect(screen.getByText(/This will exceed your credit limit/i)).toBeInTheDocument();
	});

	it("does NOT show credit hint when wallet partition selected", async () => {
		setupTransactionModalMocks();
		const { TransactionModal } = await import("../components/TransactionModal");
		render(<TransactionModal onClose={vi.fn()} />);

		// Select wallet partition
		const sourceSelect = screen.getByRole("combobox", { name: /from/i });
		await userEvent.selectOptions(sourceSelect, walletPartition.id.toString());

		// Credit hint should NOT appear
		expect(screen.queryByText(/Credit available/i)).toBeNull();
	});
});

// ============================================================================
// CRDT-01, CRDT-03: PayCreditModal
// ============================================================================

describe("PayCreditModal", () => {
	beforeEach(() => {
		// Only non-credit partitions shown in pay-from selector
		vi.mocked(useTable).mockReturnValue([[walletPartition], true]);
	});

	it("renders Pay Credit modal title", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal partitionId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByText("Pay Credit")).toBeInTheDocument();
	});

	it("renders amount pre-filled with outstanding balance", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal partitionId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		// P6,200 = 620000 centavos = "6200.00"
		const amountInput = screen.getByLabelText(/^Amount$/i);
		expect((amountInput as HTMLInputElement).value).toBe("6200.00");
	});

	it("dismiss button is labeled Keep balance", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal partitionId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByRole("button", { name: /Keep balance/i })).toBeInTheDocument();
	});

	it("submit button is labeled Confirm payment", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal partitionId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByRole("button", { name: /Confirm payment/i })).toBeInTheDocument();
	});

	it("renders Service fee input field", async () => {
		const { PayCreditModal } = await import("../components/PayCreditModal");
		render(<PayCreditModal partitionId={1n} outstandingCentavos={620000n} onClose={vi.fn()} />);
		expect(screen.getByLabelText(/Service fee/i)).toBeInTheDocument();
	});
});

// ============================================================================
// PartitionModal edit mode
// ============================================================================

describe("PartitionModal edit mode", () => {
	const editPartition = {
		id: 1n,
		accountId: 1n,
		name: "RCBC Credit",
		balanceCentavos: 620000n,
		partitionType: "credit",
		creditLimitCentavos: 12000000n,
		isDefault: false,
		createdAt: { microsSinceUnixEpoch: 0n },
	};

	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[], true]);
	});

	it("renders 'Edit partition' title in edit mode", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(
			<PartitionModal
				accountId={1n}
				isStandalone={false}
				onClose={vi.fn()}
				partition={editPartition}
			/>,
		);
		expect(screen.getByText("Edit partition")).toBeInTheDocument();
	});

	it("pre-fills name and credit limit from partition prop", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(
			<PartitionModal
				accountId={1n}
				isStandalone={false}
				onClose={vi.fn()}
				partition={editPartition}
			/>,
		);
		expect(screen.getByDisplayValue("RCBC Credit")).toBeInTheDocument();
		expect(screen.getByDisplayValue("120000.00")).toBeInTheDocument();
	});

	it("partition type select is disabled in edit mode", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(
			<PartitionModal
				accountId={1n}
				isStandalone={false}
				onClose={vi.fn()}
				partition={editPartition}
			/>,
		);
		const typeSelect = screen.getByLabelText(/Partition type/i);
		expect(typeSelect).toBeDisabled();
	});

	it("does not show initial balance field in edit mode", async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(
			<PartitionModal
				accountId={1n}
				isStandalone={false}
				onClose={vi.fn()}
				partition={editPartition}
			/>,
		);
		expect(screen.queryByLabelText(/Initial balance/i)).not.toBeInTheDocument();
	});
});
