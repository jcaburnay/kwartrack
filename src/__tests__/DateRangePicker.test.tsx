import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "../components/transactions/DateRangePicker";

describe("DateRangePicker", () => {
	it("shows the active preset label", () => {
		render(
			<DateRangePicker preset="this-month" customFrom={null} customTo={null} onChange={() => {}} />,
		);
		expect(screen.getByRole("button")).toHaveTextContent(/this month/i);
	});

	it("emits onChange with selected preset and clears custom", () => {
		const onChange = vi.fn();
		render(
			<DateRangePicker preset="this-month" customFrom={null} customTo={null} onChange={onChange} />,
		);
		fireEvent.click(screen.getByRole("button"));
		fireEvent.click(screen.getByText(/last 30 days/i));
		expect(onChange).toHaveBeenCalledWith({
			preset: "last-30-days",
			customFrom: null,
			customTo: null,
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
		const fromInput = screen.getByLabelText(/from/i) as HTMLInputElement;
		const toInput = screen.getByLabelText(/to/i) as HTMLInputElement;
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
		expect(screen.queryByLabelText(/from/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/to/i)).not.toBeInTheDocument();
	});
});
