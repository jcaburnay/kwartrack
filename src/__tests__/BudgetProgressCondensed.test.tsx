import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { BudgetProgressCondensed } from "../components/overview/BudgetProgressCondensed";
import type { BudgetAllocation } from "../hooks/useBudget";

const TAGS = [
	{ id: "t1", name: "foods" },
	{ id: "t2", name: "bills" },
];

const allocations: BudgetAllocation[] = [
	{
		id: "a1",
		user_id: "u1",
		month: "2026-04",
		tag_id: "t1",
		amount_centavos: 1000_00,
		created_at: "",
		updated_at: "",
	},
	{
		id: "a2",
		user_id: "u1",
		month: "2026-04",
		tag_id: "t2",
		amount_centavos: 500_00,
		created_at: "",
		updated_at: "",
	},
];

function renderPanel(props: Partial<React.ComponentProps<typeof BudgetProgressCondensed>>) {
	const defaults: React.ComponentProps<typeof BudgetProgressCondensed> = {
		actualsByTag: new Map(),
		overallActualCentavos: 0,
		overallCapCentavos: 2000_00,
		allocations,
		// biome-ignore lint/suspicious/noExplicitAny: stubs in tests
		tags: TAGS as any,
		isLoading: false,
	};
	return render(
		<MemoryRouter>
			<BudgetProgressCondensed {...defaults} {...props} />
		</MemoryRouter>,
	);
}

describe("BudgetProgressCondensed", () => {
	it("renders an Overall progress bar", () => {
		renderPanel({ overallActualCentavos: 800_00, overallCapCentavos: 1000_00 });
		expect(screen.getByText("Overall")).toBeInTheDocument();
	});

	it("uses progress-success class when <80%", () => {
		const { container } = renderPanel({
			overallActualCentavos: 500_00,
			overallCapCentavos: 1000_00,
		});
		expect(container.querySelector(".progress-success")).toBeInTheDocument();
	});

	it("uses progress-warning class when 80–100%", () => {
		const { container } = renderPanel({
			overallActualCentavos: 850_00,
			overallCapCentavos: 1000_00,
		});
		expect(container.querySelector(".progress-warning")).toBeInTheDocument();
	});

	it("uses progress-error class when >100%", () => {
		const { container } = renderPanel({
			overallActualCentavos: 1100_00,
			overallCapCentavos: 1000_00,
		});
		expect(container.querySelector(".progress-error")).toBeInTheDocument();
	});

	it("renders the No-Budget CTA when overallCap is 0", () => {
		renderPanel({ overallCapCentavos: 0 });
		expect(screen.getByText(/No budget set/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Set Budget/i })).toHaveAttribute("href", "/budget");
	});

	it("renders top tags by actual descending", () => {
		const actuals = new Map([
			["t1", 200_00], // 20%
			["t2", 480_00], // 96%
		]);
		renderPanel({
			actualsByTag: actuals,
			overallActualCentavos: 680_00,
			overallCapCentavos: 1500_00,
		});
		const rows = screen.getAllByTestId("budget-progress-row");
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent("bills");
		expect(rows[1]).toHaveTextContent("foods");
	});

	it("hides the top-tag rows when no allocated tag has actual spend", () => {
		renderPanel({ actualsByTag: new Map(), overallActualCentavos: 0, overallCapCentavos: 1000_00 });
		expect(screen.queryByTestId("budget-progress-row")).not.toBeInTheDocument();
	});
});
