import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../components/transactions/DateRangePicker";

describe("DateRangePicker", () => {
	it("reflects the active preset on the select", () => {
		render(
			<DateRangePicker preset="this-month" customFrom={null} customTo={null} onChange={() => {}} />,
		);
		const select = screen.getByLabelText(/date range/i) as HTMLSelectElement;
		expect(select.value).toBe("this-month");
	});

	it("emits onChange with selected preset and clears custom on a non-custom pick", () => {
		const onChange = vi.fn();
		render(
			<DateRangePicker preset="this-month" customFrom={null} customTo={null} onChange={onChange} />,
		);
		const select = screen.getByLabelText(/date range/i);
		fireEvent.change(select, { target: { value: "last-30-days" } });
		expect(onChange).toHaveBeenCalledWith({
			preset: "last-30-days",
			customFrom: null,
			customTo: null,
		});
	});

	it("preserves custom dates when picking the custom preset", () => {
		const onChange = vi.fn();
		render(
			<DateRangePicker
				preset="this-month"
				customFrom="2026-04-01"
				customTo="2026-04-15"
				onChange={onChange}
			/>,
		);
		const select = screen.getByLabelText(/date range/i);
		fireEvent.change(select, { target: { value: "custom" } });
		expect(onChange).toHaveBeenCalledWith({
			preset: "custom",
			customFrom: "2026-04-01",
			customTo: "2026-04-15",
		});
	});

	it("reveals two date inputs when Custom… is selected", () => {
		const onChange = vi.fn();
		render(
			<DateRangePicker
				preset="custom"
				customFrom="2026-04-01"
				customTo="2026-04-15"
				onChange={onChange}
			/>,
		);
		const fromInput = screen.getByLabelText(/^from$/i) as HTMLInputElement;
		const toInput = screen.getByLabelText(/^to$/i) as HTMLInputElement;
		expect(fromInput.value).toBe("2026-04-01");
		expect(toInput.value).toBe("2026-04-15");

		fireEvent.change(fromInput, { target: { value: "2026-04-05" } });
		expect(onChange).toHaveBeenCalledWith({
			preset: "custom",
			customFrom: "2026-04-05",
			customTo: "2026-04-15",
		});
	});

	it("does not show date inputs for non-custom presets", () => {
		render(
			<DateRangePicker preset="this-month" customFrom={null} customTo={null} onChange={() => {}} />,
		);
		expect(screen.queryByLabelText(/^from$/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/^to$/i)).not.toBeInTheDocument();
	});
});
