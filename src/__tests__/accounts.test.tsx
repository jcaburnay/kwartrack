import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useTable } from "spacetimedb/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPesos } from "../utils/currency";

// =============================================================================
// formatPesos unit tests — these are GREEN immediately (no component dependency)
// =============================================================================
describe("formatPesos", () => {
	it("formats 0 centavos as P0.00", () => {
		expect(formatPesos(0n)).toBe("P0.00");
	});
	it("formats 500 centavos as P5.00", () => {
		expect(formatPesos(500n)).toBe("P5.00");
	});
	it("formats 12050000 centavos as P120,500.00", () => {
		expect(formatPesos(12050000n)).toBe("P120,500.00");
	});
	it("formats 100 centavos as P1.00", () => {
		expect(formatPesos(100n)).toBe("P1.00");
	});
});

// =============================================================================
// AccountsPage tests — RED until Plan 03 creates AccountsPage
// =============================================================================
describe("AccountsPage", () => {
	beforeEach(() => {
		vi.mocked(useTable).mockReturnValue([[], true]);
	});

	it("renders ACCOUNTS section heading", async () => {
		const { AccountsPage } = await import("../pages/AccountsPage");
		render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("Accounts")).toBeInTheDocument();
	});

	it("renders empty state when no accounts and isReady=true", async () => {
		vi.mocked(useTable).mockReturnValue([[], true]);
		const { AccountsPage } = await import("../pages/AccountsPage");
		render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("New account")).toBeInTheDocument();
	});

	it("renders nothing when isReady=false", async () => {
		vi.mocked(useTable).mockReturnValue([[], false]);
		const { AccountsPage } = await import("../pages/AccountsPage");
		const { container } = render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		expect(container).toBeEmptyDOMElement();
	});
});

// =============================================================================
// AccountModal tests — RED until Plan 03 creates AccountModal
// =============================================================================
describe("AccountModal", () => {
	it('shows "Account name is required" when name is empty on submit', async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: /save account/i }));
		await waitFor(() => expect(screen.getByText("Account name is required")).toBeInTheDocument());
	});

	it('shows "Save Maya" when name field contains "Maya"', async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		fireEvent.change(screen.getByPlaceholderText(/maya, gcash, rcbc/i), {
			target: { value: "Maya" },
		});
		expect(screen.getByRole("button", { name: "Save Maya" })).toBeInTheDocument();
	});

	it("shows standalone hint when initial balance > 0", async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		fireEvent.change(screen.getByPlaceholderText("0.00"), {
			target: { value: "1000" },
		});
		expect(
			screen.getByText("Initial balance set — this will be a standalone account"),
		).toBeInTheDocument();
	});
});

// =============================================================================
// PartitionModal tests — RED until Plan 04 creates PartitionModal
// =============================================================================
describe("PartitionModal", () => {
	it('shows "Partition name is required" when name is empty on submit', async () => {
		const { PartitionModal } = await import("../components/PartitionModal");
		render(<PartitionModal accountId={1n} isStandalone={false} onClose={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: /save partition/i }));
		await waitFor(() => expect(screen.getByText("Partition name is required")).toBeInTheDocument());
	});
});

// =============================================================================
// DeleteConfirmModal tests — RED until Plan 04 creates DeleteConfirmModal
// =============================================================================
describe("DeleteConfirmModal", () => {
	it("renders title, confirm button, and dismiss button with item names", async () => {
		const { DeleteConfirmModal } = await import("../components/DeleteConfirmModal");
		render(
			<DeleteConfirmModal
				title="Delete Maya?"
				body="This will permanently delete Maya and all its partitions. This cannot be undone."
				confirmLabel="Delete Maya"
				dismissLabel="Keep Maya"
				onConfirm={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		expect(screen.getByText("Delete Maya?")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Delete Maya" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Keep Maya" })).toBeInTheDocument();
	});
});
