import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PillToggle } from "../components/ui/PillToggle";

const OPTIONS = [
	{ value: null, label: "All" },
	{ value: "expense" as const, label: "Expenses" },
	{ value: "income" as const, label: "Income" },
];

describe("PillToggle", () => {
	it("renders one button per option", () => {
		render(<PillToggle value={null} options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Expenses" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Income" })).toBeInTheDocument();
	});

	it("marks the active button with aria-pressed=true and others false", () => {
		render(<PillToggle value="expense" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
		expect(screen.getByRole("button", { name: "Expenses" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "Income" })).toHaveAttribute("aria-pressed", "false");
	});

	it("applies btn-primary to the active button and btn-ghost to inactive", () => {
		render(<PillToggle value="expense" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("button", { name: "Expenses" }).className).toMatch(/btn-primary/);
		expect(screen.getByRole("button", { name: "All" }).className).toMatch(/btn-ghost/);
	});

	it("calls onChange with the option value when a button is clicked", () => {
		const onChange = vi.fn();
		render(<PillToggle value={null} options={OPTIONS} onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
		expect(onChange).toHaveBeenCalledWith("expense");
	});

	it("renders inside a join container with optional aria-label and role=group", () => {
		const { container } = render(
			<PillToggle ariaLabel="Type filter" value={null} options={OPTIONS} onChange={vi.fn()} />,
		);
		const group = container.querySelector('[role="group"]');
		expect(group).not.toBeNull();
		expect(group).toHaveAttribute("aria-label", "Type filter");
		expect(group?.className).toMatch(/join/);
	});
});
