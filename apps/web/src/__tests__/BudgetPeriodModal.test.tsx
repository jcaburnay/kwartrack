import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetPeriodModal } from "../components/budget/BudgetPeriodModal";

describe("budget period form", () => {
	it("suggests next month's same day and preserves manually edited end dates", async () => {
		render(
			<BudgetPeriodModal startDate="2026-11-15" periods={[]} onSave={vi.fn()} onCancel={vi.fn()} />,
		);
		expect(screen.getByLabelText("End date")).toHaveValue("2026-12-15");
		fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-21" } });
		expect(screen.getByLabelText("End date")).toHaveValue("2027-01-21");
		fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-01-25" } });
		fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-22" } });
		expect(screen.getByLabelText("End date")).toHaveValue("2027-01-25");
		expect(screen.getByText(/both dates are included/i)).toBeInTheDocument();
	});
	it("saves inclusive dates and cap, and reports overlap errors", async () => {
		const save = vi.fn().mockResolvedValue(null);
		const user = userEvent.setup();
		render(
			<BudgetPeriodModal startDate="2026-11-15" periods={[]} onSave={save} onCancel={vi.fn()} />,
		);
		fireEvent.change(screen.getByLabelText("Overall cap (₱)"), { target: { value: "1000" } });
		await user.click(screen.getByRole("button", { name: "Create budget" }));
		expect(save).toHaveBeenCalledWith({ start_date: "2026-11-15", end_date: "2026-12-15" }, 100000);
	});
	it("blocks overlapping dates before saving", async () => {
		const save = vi.fn();
		render(
			<BudgetPeriodModal
				startDate="2026-11-15"
				periods={[{ id: "p1", start_date: "2026-12-15", end_date: "2027-01-15" }]}
				onSave={save}
				onCancel={vi.fn()}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: "Create budget" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(/overlap/i);
		expect(save).not.toHaveBeenCalled();
	});
});
