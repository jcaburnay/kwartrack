import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetAnchor } from "../components/budget/BudgetAnchor";

const TZ = "Asia/Manila";
const today = new Date("2026-04-15T01:00:00Z"); // day 15 of 30

describe("BudgetAnchor", () => {
	it("renders the unset-budget CTA when overall is null and no copy source", () => {
		render(
			<BudgetAnchor
				month="2026-04"
				overallCentavos={null}
				actualCentavos={0}
				allocatedSumCentavos={0}
				today={today}
				timezone={TZ}
				onSetOverall={vi.fn()}
				onCopyFromPrevious={vi.fn()}
				canCopy={false}
			/>,
		);
		expect(screen.getByText(/Set a monthly budget/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /\+ Set Budget/i })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Copy from previous month/i }),
		).not.toBeInTheDocument();
	});

	it("renders Copy-from-previous button when canCopy is true", () => {
		render(
			<BudgetAnchor
				month="2026-04"
				overallCentavos={null}
				actualCentavos={0}
				allocatedSumCentavos={0}
				today={today}
				timezone={TZ}
				onSetOverall={vi.fn()}
				onCopyFromPrevious={vi.fn()}
				canCopy={true}
			/>,
		);
		expect(screen.getByRole("button", { name: /Copy from previous month/i })).toBeInTheDocument();
	});

	it("renders the progress bar and days-remaining context when budget is set", () => {
		render(
			<BudgetAnchor
				month="2026-04"
				overallCentavos={30_000_00}
				actualCentavos={6_000_00}
				allocatedSumCentavos={0}
				today={today}
				timezone={TZ}
				onSetOverall={vi.fn()}
				onCopyFromPrevious={vi.fn()}
				canCopy={false}
			/>,
		);
		// Day 15 of 30, so 15 days left.
		expect(screen.getByText(/15 days left/i)).toBeInTheDocument();
		expect(screen.getByLabelText("Edit overall cap")).toBeInTheDocument();
	});

	it("invokes onSetOverall after entering edit mode and saving", async () => {
		const onSetOverall = vi.fn(async () => null);
		render(
			<BudgetAnchor
				month="2026-04"
				overallCentavos={30_000_00}
				actualCentavos={6_000_00}
				allocatedSumCentavos={0}
				today={today}
				timezone={TZ}
				onSetOverall={onSetOverall}
				onCopyFromPrevious={vi.fn()}
				canCopy={false}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Edit overall cap"));
		const input = await screen.findByLabelText(/Monthly cap/i);
		fireEvent.change(input, { target: { value: "40000" } });
		fireEvent.click(screen.getByRole("button", { name: /Save/i }));
		// onSetOverall takes pesos converted to centavos.
		expect(onSetOverall).toHaveBeenCalledWith(40_000_00);
	});
});
