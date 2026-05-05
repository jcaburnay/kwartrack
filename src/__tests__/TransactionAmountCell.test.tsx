import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionAmountCell } from "../components/transactions/TransactionAmountCell";

describe("TransactionAmountCell", () => {
	it("renders expense with leading minus and error color", () => {
		const { container } = render(
			<TransactionAmountCell type="expense" amountCentavos={1_250_00} />,
		);
		const cell = container.firstChild as HTMLElement;
		expect(cell.textContent).toContain("−₱1,250.00");
		expect(cell.className).toMatch(/text-error/);
	});

	it("renders income with leading plus and success color", () => {
		const { container } = render(
			<TransactionAmountCell type="income" amountCentavos={45_000_00} />,
		);
		const cell = container.firstChild as HTMLElement;
		expect(cell.textContent).toContain("+₱45,000.00");
		expect(cell.className).toMatch(/text-success/);
	});

	it("renders transfer without sign and default color", () => {
		const { container } = render(
			<TransactionAmountCell type="transfer" amountCentavos={5_000_00} />,
		);
		const cell = container.firstChild as HTMLElement;
		expect(cell.textContent).toContain("₱5,000.00");
		expect(cell.textContent).not.toContain("+");
		expect(cell.textContent).not.toContain("−");
		expect(cell.className).not.toMatch(/text-(error|success)/);
	});

	it("renders fee sub-line when feeCentavos is non-null and non-zero", () => {
		render(<TransactionAmountCell type="expense" amountCentavos={1_250_00} feeCentavos={15_00} />);
		expect(screen.getByText(/\+₱15\.00 fee/)).toBeInTheDocument();
	});

	it("does not render fee sub-line when feeCentavos is null or zero", () => {
		const { rerender } = render(
			<TransactionAmountCell type="expense" amountCentavos={1_250_00} feeCentavos={null} />,
		);
		expect(screen.queryByText(/fee/i)).not.toBeInTheDocument();

		rerender(<TransactionAmountCell type="expense" amountCentavos={1_250_00} feeCentavos={0} />);
		expect(screen.queryByText(/fee/i)).not.toBeInTheDocument();
	});
});
