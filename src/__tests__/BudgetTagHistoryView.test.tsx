import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetTagHistoryView } from "../components/budget/BudgetTagHistoryView";
import type { Tag } from "../hooks/useTags";
import type { BudgetHistoryMonth } from "../utils/budgetHistory";

const tags: Tag[] = [
	{
		id: "t-foods",
		user_id: "u",
		name: "foods",
		type: "expense",
		is_system: false,
		created_at: "",
	} as unknown as Tag,
];

const history: BudgetHistoryMonth[] = [
	{
		monthISO: "2026-02",
		monthLabel: "Feb 2026",
		allocatedByTag: new Map([["t-foods", 10_000_00]]),
		actualsByTag: new Map([["t-foods", 9_000_00]]),
	},
	{
		monthISO: "2026-03",
		monthLabel: "Mar 2026",
		allocatedByTag: new Map(),
		actualsByTag: new Map([["t-foods", 11_000_00]]),
	},
	{
		monthISO: "2026-04",
		monthLabel: "Apr 2026",
		allocatedByTag: new Map([["t-foods", 12_000_00]]),
		actualsByTag: new Map([["t-foods", 4_000_00]]),
	},
];

describe("BudgetTagHistoryView", () => {
	it("renders the tag picker with the selected tag", () => {
		render(
			<BudgetTagHistoryView
				tags={tags}
				history={history}
				selectedTagId="t-foods"
				onSelectTag={() => {}}
				isLoading={false}
			/>,
		);
		expect(screen.getByLabelText("Tag")).toBeInTheDocument();
	});

	it("renders the empty state when the selected tag has no data in range", () => {
		render(
			<BudgetTagHistoryView
				tags={tags}
				history={history.map((h) => ({
					...h,
					allocatedByTag: new Map(),
					actualsByTag: new Map(),
				}))}
				selectedTagId="t-foods"
				onSelectTag={() => {}}
				isLoading={false}
			/>,
		);
		expect(screen.getByText(/No data for this range/i)).toBeInTheDocument();
	});
});
