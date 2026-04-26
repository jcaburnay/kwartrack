import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewPage } from "../pages/OverviewPage";

// jsdom does not implement ResizeObserver; Recharts' ResponsiveContainer requires it.
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	globalThis.ResizeObserver ?? (ResizeObserverMock as unknown as typeof ResizeObserver);

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({
		profile: {
			id: "u1",
			display_name: "Test",
			email: "x@x.x",
			timezone: "Asia/Manila",
			theme: "system",
		},
		signOut: vi.fn(),
	}),
}));

vi.mock("../hooks/useAccounts", () => ({ useAccounts: vi.fn() }));
vi.mock("../hooks/useRecurrings", () => ({ useRecurrings: vi.fn() }));
vi.mock("../hooks/useDebtsAndSplits", () => ({ useDebtsAndSplits: vi.fn() }));
vi.mock("../hooks/useBudget", () => ({ useBudget: vi.fn() }));
vi.mock("../hooks/useMonthlySpendTrend", () => ({ useMonthlySpendTrend: vi.fn() }));
vi.mock("../hooks/useTags", () => ({ useTags: vi.fn() }));
vi.mock("../hooks/useAccountGroups", () => ({
	useAccountGroups: () => ({ groups: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

import { useAccounts } from "../hooks/useAccounts";
import { useBudget } from "../hooks/useBudget";
import { useDebtsAndSplits } from "../hooks/useDebtsAndSplits";
import { useMonthlySpendTrend } from "../hooks/useMonthlySpendTrend";
import { useRecurrings } from "../hooks/useRecurrings";
import { useTags } from "../hooks/useTags";

const HOOK_DEFAULTS = {
	accounts: { accounts: [], isLoading: false, error: null, refetch: vi.fn() },
	recurrings: { recurrings: [], isLoading: false, error: null, refetch: vi.fn() },
	debts: {
		debts: [],
		splits: [],
		isLoading: false,
		error: null,
		refetch: vi.fn(),
		balance: { owedCentavos: 0, oweCentavos: 0 },
		hasUnsettledLoaned: false,
		createSplit: vi.fn(),
		updateSplit: vi.fn(),
		deleteSplit: vi.fn(),
		createDebt: vi.fn(),
		deleteDebt: vi.fn(),
		settleDebt: vi.fn(),
		splitParticipants: vi.fn(),
	},
	budget: {
		config: null,
		allocations: [],
		monthExpenses: [],
		actualsByTag: new Map<string, number>(),
		othersCentavos: 0,
		overallActualCentavos: 0,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
		setOverall: vi.fn(),
		upsertAllocation: vi.fn(),
		deleteAllocation: vi.fn(),
		copyFromPrevious: vi.fn(),
	},
	trend: { trend: [], isLoading: false, error: null, refetch: vi.fn() },
	tags: {
		tags: [],
		isLoading: false,
		error: null,
		refetch: vi.fn(),
		createInline: vi.fn(),
		createTag: vi.fn(),
		renameTag: vi.fn(),
		deleteTag: vi.fn(),
	},
};

beforeEach(() => {
	vi.mocked(useAccounts).mockReturnValue(
		HOOK_DEFAULTS.accounts as unknown as ReturnType<typeof useAccounts>,
	);
	vi.mocked(useRecurrings).mockReturnValue(
		HOOK_DEFAULTS.recurrings as unknown as ReturnType<typeof useRecurrings>,
	);
	vi.mocked(useDebtsAndSplits).mockReturnValue(
		HOOK_DEFAULTS.debts as unknown as ReturnType<typeof useDebtsAndSplits>,
	);
	vi.mocked(useBudget).mockReturnValue(
		HOOK_DEFAULTS.budget as unknown as ReturnType<typeof useBudget>,
	);
	vi.mocked(useMonthlySpendTrend).mockReturnValue(
		HOOK_DEFAULTS.trend as unknown as ReturnType<typeof useMonthlySpendTrend>,
	);
	vi.mocked(useTags).mockReturnValue(HOOK_DEFAULTS.tags as unknown as ReturnType<typeof useTags>);
});

afterEach(() => {
	vi.clearAllMocks();
});

function renderPage() {
	return render(
		<MemoryRouter>
			<OverviewPage />
		</MemoryRouter>,
	);
}

describe("OverviewPage", () => {
	it("shows the WelcomeCard when no accounts exist", () => {
		renderPage();
		expect(screen.getByText(/Welcome to Kwartrack/)).toBeInTheDocument();
	});

	it("hides Spend Trend / Budget / Upcoming when no accounts exist", () => {
		renderPage();
		expect(screen.queryByText(/Monthly Spend/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Budget — this month/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Upcoming/i)).not.toBeInTheDocument();
	});

	it("renders all four panels when an account exists", () => {
		vi.mocked(useAccounts).mockReturnValue({
			...HOOK_DEFAULTS.accounts,
			accounts: [
				{
					id: "a1",
					user_id: "u1",
					group_id: null,
					name: "Wallet",
					type: "cash",
					initial_balance_centavos: 1000_00,
					balance_centavos: 1000_00,
					is_archived: false,
					credit_limit_centavos: null,
					installment_limit_centavos: null,
					principal_centavos: null,
					interest_rate_bps: null,
					maturity_date: null,
					interest_posting_interval: null,
					interest_recurring_id: null,
					is_matured: false,
					created_at: "",
					updated_at: "",
				},
			],
		} as unknown as ReturnType<typeof useAccounts>);
		renderPage();
		expect(screen.queryByText(/Welcome to Kwartrack/)).not.toBeInTheDocument();
		expect(screen.getByText("Total Assets")).toBeInTheDocument();
		expect(screen.getByText(/Monthly Spend/i)).toBeInTheDocument();
		expect(screen.getByText(/Budget — this month/i)).toBeInTheDocument();
		expect(screen.getByText("Upcoming")).toBeInTheDocument();
	});

	it("shows skeleton-equivalent in OverviewHero when accounts hook is loading", () => {
		vi.mocked(useAccounts).mockReturnValue({
			...HOOK_DEFAULTS.accounts,
			isLoading: true,
		} as unknown as ReturnType<typeof useAccounts>);
		const { container } = renderPage();
		expect(container.querySelectorAll(".skeleton").length).toBeGreaterThanOrEqual(1);
	});
});
