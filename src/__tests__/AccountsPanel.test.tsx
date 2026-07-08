import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const mockTransaction = {
	id: "tx-1",
	user_id: "u1",
	amount_centavos: 100_00,
	type: "income",
	tag_id: null,
	from_account_id: null,
	to_account_id: "acc-1",
	fee_centavos: null,
	description: "Salary",
	date: "2026-07-08",
	parent_transaction_id: null,
	created_at: "2026-07-08T00:00:00Z",
	updated_at: "2026-07-08T00:00:00Z",
	recurring_id: null,
	split_id: null,
	debt_id: null,
	is_installment_portion: false,
	recurring: null,
};

const mockLoadMore = vi.fn();
const mockRefetchTransactions = vi.fn();
const mockRefetchMonthSummary = vi.fn();
let mockTransactionList = {
	transactions: [] as (typeof mockTransaction)[],
	totalCount: 0,
	isLoading: false,
	isLoadingMore: false,
	error: null as string | null,
	refetch: mockRefetchTransactions,
	loadMore: mockLoadMore,
	hasMore: false,
};
let mockMonthSummary = {
	summary: {
		netInflowCentavos: 0,
		netOutflowCentavos: 0,
		netCentavos: 0,
		accountInflowCentavos: 0,
		accountOutflowCentavos: 0,
	},
	isLoading: false,
	error: null as string | null,
	refetch: mockRefetchMonthSummary,
};

vi.mock("../hooks/useAccounts", () => ({
	useAccounts: () => ({ accounts: [mockAccount], isLoading: false, refetch: vi.fn() }),
}));
vi.mock("../hooks/useAccountGroups", () => ({
	useAccountGroups: () => ({ groups: [], refetch: vi.fn() }),
}));
vi.mock("../hooks/useTransactionListQuery", () => ({
	useTransactionListQuery: () => mockTransactionList,
}));
vi.mock("../hooks/useTransactionMonthSummary", () => ({
	useTransactionMonthSummary: () => mockMonthSummary,
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
	beforeEach(() => {
		window.localStorage.clear();
		mockLoadMore.mockClear();
		mockRefetchTransactions.mockClear();
		mockRefetchMonthSummary.mockClear();
		mockTransactionList = {
			transactions: [],
			totalCount: 0,
			isLoading: false,
			isLoadingMore: false,
			error: null,
			refetch: mockRefetchTransactions,
			loadMore: mockLoadMore,
			hasMore: false,
		};
		mockMonthSummary = {
			summary: {
				netInflowCentavos: 0,
				netOutflowCentavos: 0,
				netCentavos: 0,
				accountInflowCentavos: 0,
				accountOutflowCentavos: 0,
			},
			isLoading: false,
			error: null,
			refetch: mockRefetchMonthSummary,
		};
	});

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

	it("shows server total count and loads the next transaction page", async () => {
		const user = userEvent.setup();
		mockTransactionList = {
			...mockTransactionList,
			transactions: [mockTransaction],
			totalCount: 125,
			hasMore: true,
		};

		renderPanel();

		expect(screen.getByText("125")).toBeInTheDocument();
		expect(screen.getByText("Showing 1 of 125")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /load more/i }));
		expect(mockLoadMore).toHaveBeenCalledTimes(1);
	});

	it("shows placeholder text in right pane when nothing is selected", () => {
		renderPanel();
		expect(screen.getByText(/select an account or group/i)).toBeInTheDocument();
	});
});
