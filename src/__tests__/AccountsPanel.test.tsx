import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AccountsPanel } from "../components/panels/AccountsPanel";

const mockAccount = {
	id: "acc-1",
	name: "BPI Savings",
	type: "savings",
	balance_centavos: 27394600,
	is_archived: false,
	is_matured: false,
	group_id: null,
	user_id: "u1",
	credit_limit_centavos: null,
	initial_balance_centavos: 0,
	created_at: "2024-01-01",
	updated_at: "2024-01-01",
	current_balance_centavos: 27394600,
};

vi.mock("../hooks/useAccounts", () => ({
	useAccounts: () => ({ accounts: [mockAccount], isLoading: false, refetch: vi.fn() }),
}));
vi.mock("../hooks/useAccountGroups", () => ({
	useAccountGroups: () => ({ groups: [], refetch: vi.fn() }),
}));
vi.mock("../hooks/useTransactions", () => ({
	useTransactions: () => ({ transactions: [], isLoading: false, refetch: vi.fn() }),
}));
vi.mock("../hooks/useTags", () => ({
	useTags: () => ({ tags: [], createInline: vi.fn() }),
}));
vi.mock("../hooks/useRecurrings", () => ({
	useRecurrings: () => ({ recurrings: [] }),
}));
vi.mock("../hooks/useSelectedAccount", () => ({
	useSelectedAccount: () => ({
		selection: { kind: "none" },
		selectAccount: vi.fn(),
		selectGroup: vi.fn(),
		clear: vi.fn(),
	}),
}));
vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({ profile: { display_name: "Test", timezone: "Asia/Manila" } }),
}));

function renderPanel() {
	return render(
		<MemoryRouter>
			<AccountsPanel />
		</MemoryRouter>,
	);
}

describe("AccountsPanel", () => {
	it("renders accounts section header", () => {
		renderPanel();
		expect(screen.getByText(/accounts/i)).toBeInTheDocument();
	});

	it("renders transactions section header", () => {
		renderPanel();
		expect(screen.getAllByText(/transactions/i).length).toBeGreaterThan(0);
	});

	it("folds accounts section to a strip when chevron clicked", async () => {
		const user = userEvent.setup();
		renderPanel();
		const foldBtn = screen.getByRole("button", { name: /fold accounts/i });
		await user.click(foldBtn);
		expect(screen.getByText(/1 account/i)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /fold accounts/i })).not.toBeInTheDocument();
	});

	it("expands accounts section when strip is clicked", async () => {
		const user = userEvent.setup();
		renderPanel();
		await user.click(screen.getByRole("button", { name: /fold accounts/i }));
		await user.click(screen.getByRole("button", { name: /expand accounts/i }));
		expect(screen.getByRole("button", { name: /fold accounts/i })).toBeInTheDocument();
	});

	it("folds transactions section to a strip when chevron clicked", async () => {
		const user = userEvent.setup();
		renderPanel();
		const foldBtn = screen.getByRole("button", { name: /fold transactions/i });
		await user.click(foldBtn);
		expect(screen.getByText(/0 transactions/i)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /fold transactions/i })).not.toBeInTheDocument();
	});

	it("expands transactions section when strip is clicked", async () => {
		const user = userEvent.setup();
		renderPanel();
		await user.click(screen.getByRole("button", { name: /fold transactions/i }));
		await user.click(screen.getByRole("button", { name: /expand transactions/i }));
		expect(screen.getByRole("button", { name: /fold transactions/i })).toBeInTheDocument();
	});

	it("shows placeholder text in right pane when nothing is selected", () => {
		renderPanel();
		expect(screen.getByText(/select an account or group/i)).toBeInTheDocument();
	});
});
