import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetWorkspace } from "../components/budget/BudgetWorkspace";

const state = vi.hoisted(() => ({ today: "2026-11-15" }));
const period = {
	id: "budget-1",
	user_id: "u1",
	start_date: "2026-11-15",
	end_date: "2026-12-15",
	overall_centavos: 1000000,
	legacy_month: null,
	created_at: "",
	updated_at: "",
};
vi.mock("../hooks/useBudgetPeriods", () => ({
	useTodayISO: () => state.today,
	useBudgetPeriods: () => ({
		periods: [period],
		isLoading: false,
		error: null,
		savePeriod: vi.fn(),
	}),
}));
vi.mock("../hooks/useBudgetPeriodHistory", () => ({
	useBudgetPeriodHistory: () => ({ history: [], isLoading: false, error: null }),
}));
const foodsTag = {
	id: "tag-foods",
	user_id: "u1",
	name: "foods",
	type: "expense",
	is_system: false,
	created_at: "2026-07-08T00:00:00Z",
	updated_at: "2026-07-08T00:00:00Z",
} as const;

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({ profile: { timezone: "Asia/Manila" } }),
}));

vi.mock("../hooks/useBudget", () => ({
	useBudget: () => ({
		config: {
			id: "budget-1",
			user_id: "u1",
			start_date: "2026-11-15",
			end_date: "2026-12-15",
			overall_centavos: 10_000_00,
			created_at: "2026-07-08T00:00:00Z",
			updated_at: "2026-07-08T00:00:00Z",
		},
		allocations: [
			{
				id: "a1",
				user_id: "u1",
				period_id: "budget-1",
				tag_id: "tag-foods",
				amount_centavos: 10000,
				created_at: "",
				updated_at: "",
			},
		],
		actualsByTag: new Map(),
		othersCentavos: 0,
		overallActualCentavos: 0,
		isLoading: false,
		error: null,
		setOverall: vi.fn(),
		upsertAllocation: vi.fn(),
		deleteAllocation: vi.fn(),
		copyFromPrevious: vi.fn(),
	}),
}));

vi.mock("../hooks/useBudgetHistory", () => ({
	useBudgetHistory: () => ({ history: [], isLoading: false }),
}));

vi.mock("../hooks/useOverallBudgetHistory", () => ({
	useOverallBudgetHistory: () => ({ history: [], isLoading: false }),
}));

vi.mock("../hooks/useTags", () => ({
	useTags: () => ({ tags: [foodsTag], isLoading: false }),
}));

describe("BudgetWorkspace", () => {
	beforeEach(() => {
		window.localStorage.clear();
		state.today = "2026-11-15";
	});

	it("shows no active budget during a gap while retaining historical selection", async () => {
		state.today = "2026-12-20";
		render(<BudgetWorkspace />);
		expect(screen.getByLabelText("Budget period")).toHaveValue("");
		expect(screen.getByText(/create a budget for your next date range/i)).toBeInTheDocument();
		await userEvent.selectOptions(screen.getByLabelText("Budget period"), period.id);
		expect(screen.getByRole("button", { name: "Edit dates and cap" })).toBeInTheDocument();
	});
	it("drills into transactions using both inclusive dates", async () => {
		const drill = vi.fn();
		render(<BudgetWorkspace onDrillToTag={drill} />);
		await userEvent.click(screen.getByRole("button", { name: "View foods transactions" }));
		expect(drill).toHaveBeenCalledWith(
			"tag-foods",
			expect.objectContaining({ start_date: "2026-11-15", end_date: "2026-12-15" }),
		);
	});
	it("persists history graph selectors across remounts", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<BudgetWorkspace />);

		await user.selectOptions(screen.getByLabelText(/budget view/i), "history");
		await user.click(screen.getByRole("radio", { name: "6 periods" }));
		await user.selectOptions(screen.getByLabelText(/^tag$/i), foodsTag.id);

		unmount();
		render(<BudgetWorkspace />);

		expect(screen.getByLabelText(/budget view/i)).toHaveValue("history");
		expect(screen.getByRole("radio", { name: "6 periods" })).toBeChecked();
		expect(screen.getByLabelText(/^tag$/i)).toHaveValue(foodsTag.id);
	});
});
