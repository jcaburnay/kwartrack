import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecurringModal } from "../components/RecurringModal";
import { getReducerSpy } from "./setup";

describe("RecurringModal", () => {
	const onClose = vi.fn();

	it("day-of-month select has exactly 28 options (1–28)", () => {
		render(<RecurringModal onClose={onClose} />);
		const select = screen.getByLabelText(/day of month/i);
		const options = select.querySelectorAll("option");
		expect(options).toHaveLength(28);
		const values = Array.from(options).map((o) => (o as HTMLOptionElement).value);
		expect(values).not.toContain("29");
		expect(values).not.toContain("31");
	});

	it('renders "Remaining occurrences" input in installment mode', () => {
		render(<RecurringModal onClose={onClose} mode="installment" />);
		const input = screen.getByLabelText("Remaining occurrences");
		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute("type", "number");
		expect(input).toHaveAttribute("max", "360");
	});

	it('hides "Remaining occurrences" input in subscription mode', () => {
		render(<RecurringModal onClose={onClose} />);
		expect(screen.queryByLabelText("Remaining occurrences")).not.toBeInTheDocument();
	});

	it("renders 6 interval options and defaults to monthly", () => {
		render(<RecurringModal onClose={onClose} />);
		const select = screen.getByLabelText(/interval/i) as HTMLSelectElement;
		const values = Array.from(select.querySelectorAll("option")).map(
			(o) => (o as HTMLOptionElement).value,
		);
		expect(values).toEqual(
			expect.arrayContaining([
				"weekly",
				"biweekly",
				"monthly",
				"quarterly",
				"semiannual",
				"yearly",
			]),
		);
		expect(values).toHaveLength(6);
		expect(select.value).toBe("monthly");
	});

	describe("conditional anchor fields by interval", () => {
		type Expectation = {
			interval: string;
			showMonth: boolean;
			showDayOfWeek: boolean;
			showDayOfMonth: boolean;
		};
		const cases: Expectation[] = [
			{ interval: "weekly", showMonth: false, showDayOfWeek: true, showDayOfMonth: false },
			{ interval: "biweekly", showMonth: false, showDayOfWeek: true, showDayOfMonth: false },
			{ interval: "monthly", showMonth: false, showDayOfWeek: false, showDayOfMonth: true },
			{ interval: "quarterly", showMonth: true, showDayOfWeek: false, showDayOfMonth: true },
			{ interval: "semiannual", showMonth: true, showDayOfWeek: false, showDayOfMonth: true },
			{ interval: "yearly", showMonth: true, showDayOfWeek: false, showDayOfMonth: true },
		];

		for (const { interval, showMonth, showDayOfWeek, showDayOfMonth } of cases) {
			it(`${interval}: month=${showMonth}, dayOfWeek=${showDayOfWeek}, dayOfMonth=${showDayOfMonth}`, async () => {
				render(<RecurringModal onClose={onClose} />);
				await userEvent.selectOptions(screen.getByLabelText(/interval/i), interval);
				expect(!!screen.queryByLabelText(/anchor month/i)).toBe(showMonth);
				expect(!!screen.queryByLabelText(/day of week/i)).toBe(showDayOfWeek);
				expect(!!screen.queryByLabelText(/day of month/i)).toBe(showDayOfMonth);
			});
		}
	});

	describe("onSubmit payload", () => {
		async function setSubAccountId(value: string) {
			const select = document.querySelector<HTMLSelectElement>("#rec-partition");
			if (!select) throw new Error("rec-partition select not found");
			const opt = document.createElement("option");
			opt.value = value;
			opt.textContent = `Account ${value}`;
			select.appendChild(opt);
			await userEvent.selectOptions(select, value);
		}

		it("weekly: sends anchorDayOfWeek from picker, anchorMonth=0, dayOfMonth=1", async () => {
			const createRecurringDefinition = getReducerSpy("createRecurringDefinition");
			render(<RecurringModal onClose={onClose} />);
			await userEvent.type(screen.getByLabelText(/name/i), "Gym");
			await userEvent.type(screen.getByLabelText(/amount/i), "50");
			await userEvent.selectOptions(screen.getByLabelText(/interval/i), "weekly");
			await userEvent.selectOptions(screen.getByLabelText(/day of week/i), "3");
			await setSubAccountId("1");
			await userEvent.click(screen.getByRole("button", { name: /add subscription/i }));
			expect(createRecurringDefinition).toHaveBeenCalledWith(
				expect.objectContaining({
					anchorDayOfWeek: 3,
					anchorMonth: 0,
					dayOfMonth: 1,
				}),
			);
		});

		it("semiannual: sends anchorMonth from picker, anchorDayOfWeek=0", async () => {
			const createRecurringDefinition = getReducerSpy("createRecurringDefinition");
			render(<RecurringModal onClose={onClose} />);
			await userEvent.type(screen.getByLabelText(/name/i), "Insurance");
			await userEvent.type(screen.getByLabelText(/amount/i), "100");
			await userEvent.selectOptions(screen.getByLabelText(/interval/i), "semiannual");
			await userEvent.selectOptions(screen.getByLabelText(/anchor month/i), "3");
			await setSubAccountId("1");
			await userEvent.click(screen.getByRole("button", { name: /add subscription/i }));
			expect(createRecurringDefinition).toHaveBeenCalledWith(
				expect.objectContaining({
					anchorMonth: 3,
					anchorDayOfWeek: 0,
				}),
			);
		});

		it("quarterly: sends anchorMonth and dayOfMonth from pickers", async () => {
			const createRecurringDefinition = getReducerSpy("createRecurringDefinition");
			render(<RecurringModal onClose={onClose} />);
			await userEvent.type(screen.getByLabelText(/name/i), "Quarterly Tax");
			await userEvent.type(screen.getByLabelText(/amount/i), "500");
			await userEvent.selectOptions(screen.getByLabelText(/interval/i), "quarterly");
			await userEvent.selectOptions(screen.getByLabelText(/anchor month/i), "3");
			await userEvent.selectOptions(screen.getByLabelText(/day of month/i), "15");
			await setSubAccountId("1");
			await userEvent.click(screen.getByRole("button", { name: /add subscription/i }));
			expect(createRecurringDefinition).toHaveBeenCalledWith(
				expect.objectContaining({
					anchorMonth: 3,
					anchorDayOfWeek: 0,
					dayOfMonth: 15,
				}),
			);
		});

		it("subscription monthly: amountCentavos is pesos×100 and totalOccurrences=0", async () => {
			const createRecurringDefinition = getReducerSpy("createRecurringDefinition");
			render(<RecurringModal onClose={onClose} />);
			await userEvent.type(screen.getByLabelText(/name/i), "Netflix");
			await userEvent.type(screen.getByLabelText(/amount/i), "799.50");
			await userEvent.selectOptions(screen.getByLabelText(/interval/i), "monthly");
			await userEvent.selectOptions(screen.getByLabelText(/day of month/i), "15");
			await setSubAccountId("1");
			await userEvent.click(screen.getByRole("button", { name: /add subscription/i }));
			expect(createRecurringDefinition).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Netflix",
					amountCentavos: 79_950n,
					totalOccurrences: 0,
					remainingOccurrences: 0,
				}),
			);
		});

		it("installment: totalOccurrences mirrors remainingOccurrences", async () => {
			const createRecurringDefinition = getReducerSpy("createRecurringDefinition");
			render(<RecurringModal onClose={onClose} mode="installment" />);
			await userEvent.type(screen.getByLabelText(/name/i), "Phone payment");
			await userEvent.type(screen.getByLabelText(/amount/i), "500");
			await userEvent.selectOptions(screen.getByLabelText(/^tag$/i), "gadgets");
			await userEvent.type(screen.getByLabelText(/Remaining occurrences/i), "12");
			await userEvent.selectOptions(screen.getByLabelText(/interval/i), "monthly");
			await userEvent.selectOptions(screen.getByLabelText(/day of month/i), "5");
			await setSubAccountId("1");
			await userEvent.click(screen.getByRole("button", { name: /add installment/i }));
			expect(createRecurringDefinition).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Phone payment",
					amountCentavos: 50_000n,
					remainingOccurrences: 12,
					totalOccurrences: 12,
				}),
			);
		});
	});
});
