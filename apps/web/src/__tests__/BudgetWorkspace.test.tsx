import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetWorkspace } from "../components/budget/BudgetWorkspace";

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
			month: "2026-07",
			overall_centavos: 10_000_00,
			created_at: "2026-07-08T00:00:00Z",
			updated_at: "2026-07-08T00:00:00Z",
		},
		allocations: [],
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
	});

	it("persists history graph selectors across remounts", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<BudgetWorkspace />);

		await user.selectOptions(screen.getByLabelText(/budget view/i), "history");
		await user.click(screen.getByRole("radio", { name: "6M" }));
		await user.selectOptions(screen.getByLabelText(/^tag$/i), foodsTag.id);

		unmount();
		render(<BudgetWorkspace />);

		expect(screen.getByLabelText(/budget view/i)).toHaveValue("history");
		expect(screen.getByRole("radio", { name: "6M" })).toBeChecked();
		expect(screen.getByLabelText(/^tag$/i)).toHaveValue(foodsTag.id);
	});
});
