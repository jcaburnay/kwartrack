import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecurringFilterRow } from "../components/recurring/RecurringFilterRow";
import type { Tag } from "../hooks/useTags";
import { DEFAULT_RECURRING_FILTERS, type RecurringFilters } from "../utils/recurringFilters";

const ts = "2026-04-26T00:00:00Z";

const tags: Tag[] = [
	{ id: "music", user_id: "u1", name: "music", type: "expense", is_system: false, created_at: ts },
];

function setup(overrides?: Partial<RecurringFilters>) {
	const onChange = vi.fn();
	const filters = { ...DEFAULT_RECURRING_FILTERS, ...overrides };
	render(<RecurringFilterRow filters={filters} onChange={onChange} tags={tags} />);
	return { onChange };
}

describe("RecurringFilterRow", () => {
	it("renders type pills, tag/cadence dropdowns, search, and show-completed toggle", () => {
		setup();
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Expenses" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Income" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Transfers" })).toBeInTheDocument();
		expect(screen.getByLabelText("Filter by tag")).toBeInTheDocument();
		expect(screen.getByLabelText("Filter by cadence")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Search service…")).toBeInTheDocument();
		expect(screen.getByLabelText("Show completed")).toBeInTheDocument();
	});

	it("hides the Clear button at default filters", () => {
		setup();
		expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
	});

	it("shows the Clear button when any filter is non-default", () => {
		setup({ search: "spot" });
		expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
	});

	it("emits onChange with new type when a pill is clicked", () => {
		const { onChange } = setup();
		fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "expense" }));
	});

	it("emits onChange resetting type to null when 'All' is clicked while a type is active", () => {
		const { onChange } = setup({ type: "expense" });
		fireEvent.click(screen.getByRole("button", { name: "All" }));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: null }));
	});

	it("toggling Show completed adds 'completed' to statuses", () => {
		const { onChange } = setup();
		fireEvent.click(screen.getByLabelText("Show completed"));
		const next = onChange.mock.calls[0][0] as RecurringFilters;
		expect(next.statuses.has("completed")).toBe(true);
		expect(next.statuses.has("active")).toBe(true);
		expect(next.statuses.has("paused")).toBe(true);
	});

	it("toggling Show completed off removes 'completed' from statuses", () => {
		const { onChange } = setup({
			statuses: new Set(["active", "paused", "completed"]),
		});
		fireEvent.click(screen.getByLabelText("Show completed"));
		const next = onChange.mock.calls[0][0] as RecurringFilters;
		expect(next.statuses.has("completed")).toBe(false);
	});

	it("Clear resets to default filters", () => {
		const { onChange } = setup({ search: "x", type: "income" });
		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
		expect(onChange).toHaveBeenCalledWith(DEFAULT_RECURRING_FILTERS);
	});
});
