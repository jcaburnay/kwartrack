import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BalanceStrip } from "../components/debts/BalanceStrip";

describe("BalanceStrip", () => {
	it("renders both totals", () => {
		render(<BalanceStrip owedCentavos={450000} oweCentavos={12000} />);
		expect(screen.getByText("You're owed")).toBeInTheDocument();
		expect(screen.getByText("You owe")).toBeInTheDocument();
		expect(screen.getByText(/4,500/)).toBeInTheDocument();
		expect(screen.getByText(/120/)).toBeInTheDocument();
	});
});
