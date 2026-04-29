import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetComparisonView } from "../components/budget/BudgetComparisonView";
import type { Tag } from "../hooks/useTags";

const TZ = "Asia/Manila";
const today = new Date("2026-04-15T01:00:00Z"); // day 15

const tags: Tag[] = [
	{
		id: "t-foods",
		user_id: "u",
		name: "foods",
		type: "expense",
		is_system: false,
		created_at: "",
	} as unknown as Tag,
	{
		id: "t-pets",
		user_id: "u",
		name: "pets",
		type: "expense",
		is_system: false,
		created_at: "",
	} as unknown as Tag,
];
const allocations = [
	{ tag_id: "t-foods", amount_centavos: 10_000_00, month: "2026-04", user_id: "u" } as never,
	{ tag_id: "t-pets", amount_centavos: 5_000_00, month: "2026-04", user_id: "u" } as never,
];

describe("BudgetComparisonView", () => {
	it("orders rows by projected-overshoot risk desc", () => {
		const actuals = new Map([
			["t-foods", 4_000_00], // proj 8000 → 0.8
			["t-pets", 4_000_00], // proj 8000 → 1.6
		]);
		render(
			<BudgetComparisonView
				tags={tags}
				allocations={allocations}
				actualsByTag={actuals}
				month="2026-04"
				today={today}
				timezone={TZ}
				onTagClick={vi.fn()}
			/>,
		);
		const rows = screen
			.getAllByRole("button")
			.map((b) => b.getAttribute("data-tag-id"))
			.filter((id): id is string => id != null);
		expect(rows).toEqual(["t-pets", "t-foods"]);
	});

	it("calls onTagClick with the tag id on row click", () => {
		const onTagClick = vi.fn();
		const actuals = new Map([["t-foods", 5_000_00]]);
		render(
			<BudgetComparisonView
				tags={tags}
				allocations={[allocations[0] as never]}
				actualsByTag={actuals}
				month="2026-04"
				today={today}
				timezone={TZ}
				onTagClick={onTagClick}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /foods/i }));
		expect(onTagClick).toHaveBeenCalledWith("t-foods");
	});

	it("renders an empty state when there are no allocations", () => {
		render(
			<BudgetComparisonView
				tags={tags}
				allocations={[]}
				actualsByTag={new Map()}
				month="2026-04"
				today={today}
				timezone={TZ}
				onTagClick={vi.fn()}
			/>,
		);
		expect(screen.getByText(/No tag caps yet/i)).toBeInTheDocument();
	});
});
