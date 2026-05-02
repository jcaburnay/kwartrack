import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PillToggle } from "../components/ui/PillToggle";

const OPTIONS = [
	{ value: null, label: "All" },
	{ value: "expense" as const, label: "Expenses" },
	{ value: "income" as const, label: "Income" },
];

describe("PillToggle", () => {
	it("renders one radio per option", () => {
		render(<PillToggle value={null} options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("radio", { name: "All" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Expenses" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Income" })).toBeInTheDocument();
	});

	it("checks only the active option", () => {
		render(<PillToggle value="expense" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("radio", { name: "All" })).not.toBeChecked();
		expect(screen.getByRole("radio", { name: "Expenses" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Income" })).not.toBeChecked();
	});

	it("applies btn-primary to the active label and btn-ghost to inactive", () => {
		render(<PillToggle value="expense" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("radio", { name: "Expenses" }).closest("label")?.className).toMatch(
			/btn-primary/,
		);
		expect(screen.getByRole("radio", { name: "All" }).closest("label")?.className).toMatch(
			/btn-ghost/,
		);
	});

	it("calls onChange with the option value when an option is clicked", () => {
		const onChange = vi.fn();
		render(<PillToggle value={null} options={OPTIONS} onChange={onChange} />);
		fireEvent.click(screen.getByRole("radio", { name: "Expenses" }));
		expect(onChange).toHaveBeenCalledWith("expense");
	});

	it("renders as a radiogroup inside a join container with optional aria-label", () => {
		const { container } = render(
			<PillToggle ariaLabel="Type filter" value={null} options={OPTIONS} onChange={vi.fn()} />,
		);
		const group = container.querySelector('[role="radiogroup"]');
		expect(group).not.toBeNull();
		expect(group).toHaveAttribute("aria-label", "Type filter");
		expect(group?.className).toMatch(/join/);
	});

	it("groups all radios under one form name so only one can be selected", () => {
		const { container } = render(<PillToggle value={null} options={OPTIONS} onChange={vi.fn()} />);
		const radios = container.querySelectorAll('input[type="radio"]');
		expect(radios.length).toBe(3);
		const names = new Set(Array.from(radios).map((r) => r.getAttribute("name")));
		expect(names.size).toBe(1);
	});
});
