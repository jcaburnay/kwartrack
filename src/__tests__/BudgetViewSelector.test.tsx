import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetViewSelector, type BudgetView } from "../components/budget/BudgetViewSelector";

describe("BudgetViewSelector", () => {
	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		localStorage.clear();
	});

	it("renders the three view options", () => {
		render(<BudgetViewSelector value="table" onChange={() => {}} />);
		const select = screen.getByLabelText("Budget view");
		expect(select).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Table" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Comparison" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Tag history" })).toBeInTheDocument();
	});

	it("calls onChange with the new view value", () => {
		const onChange = vi.fn<(v: BudgetView) => void>();
		render(<BudgetViewSelector value="table" onChange={onChange} />);
		fireEvent.change(screen.getByLabelText("Budget view"), { target: { value: "comparison" } });
		expect(onChange).toHaveBeenCalledWith("comparison");
	});
});
