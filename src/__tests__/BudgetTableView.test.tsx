import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetTableView } from "../components/budget/BudgetTableView";
import type { Tag } from "../hooks/useTags";

const TZ = "Asia/Manila";
const today = new Date("2026-04-15T01:00:00Z"); // day 15 of 30

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

describe("BudgetTableView", () => {
	it("orders rows by projected-overshoot risk desc", () => {
		const actuals = new Map([
			["t-foods", 4_000_00], // proj 8000 → 0.8
			["t-pets", 4_000_00], // proj 8000 → 1.6 (over allocated 5000)
		]);
		render(
			<BudgetTableView
				tags={tags}
				allocations={allocations}
				actualsByTag={actuals}
				othersCentavos={0}
				overallCentavos={20_000_00}
				month="2026-04"
				today={today}
				timezone={TZ}
				onUpsert={vi.fn(async () => null)}
				onDelete={vi.fn(async () => null)}
				disabled={false}
				focusTagId={null}
			/>,
		);
		const rows = screen
			.getAllByRole("row")
			.filter((r) => r.getAttribute("data-row-id"))
			.map((r) => r.getAttribute("data-row-id"));
		expect(rows).toEqual(["t-pets", "t-foods"]);
	});

	it("opens the New Allocation modal when '+ Add allocation' is clicked", () => {
		render(
			<BudgetTableView
				tags={tags}
				allocations={[]}
				actualsByTag={new Map()}
				othersCentavos={0}
				overallCentavos={20_000_00}
				month="2026-04"
				today={today}
				timezone={TZ}
				onUpsert={vi.fn(async () => null)}
				onDelete={vi.fn(async () => null)}
				disabled={false}
				focusTagId={null}
			/>,
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /\+ Add allocation/i }));
		const dialog = screen.getByRole("dialog");
		expect(dialog).toBeInTheDocument();
		expect(screen.getByLabelText(/Tag/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
	});

	it("opens the Edit Allocation modal when a row's pencil button is clicked", () => {
		const actuals = new Map([
			["t-foods", 4_000_00],
			["t-pets", 4_000_00],
		]);
		render(
			<BudgetTableView
				tags={tags}
				allocations={allocations}
				actualsByTag={actuals}
				othersCentavos={0}
				overallCentavos={20_000_00}
				month="2026-04"
				today={today}
				timezone={TZ}
				onUpsert={vi.fn(async () => null)}
				onDelete={vi.fn(async () => null)}
				disabled={false}
				focusTagId={null}
			/>,
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Edit foods/i }));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/Edit allocation/i)).toBeInTheDocument();
	});
});
