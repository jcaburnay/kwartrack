import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthlySpendTrend } from "../components/overview/MonthlySpendTrend";
import type { SpendTrendPoint } from "../utils/overviewAggregation";

// jsdom does not implement ResizeObserver; Recharts' ResponsiveContainer requires it.
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	globalThis.ResizeObserver ?? (ResizeObserverMock as unknown as typeof ResizeObserver);

function mkPoints(): SpendTrendPoint[] {
	return Array.from({ length: 12 }, (_, i) => ({
		monthISO: `2025-${String(i + 1).padStart(2, "0")}`,
		monthLabel: `Month ${i + 1}`,
		totalCentavos: i * 100_00,
	}));
}

describe("MonthlySpendTrend", () => {
	it("renders a section with a title", () => {
		render(<MonthlySpendTrend data={mkPoints()} isLoading={false} />);
		expect(screen.getByText(/Monthly Spend/i)).toBeInTheDocument();
	});

	it("renders a skeleton when loading", () => {
		const { container } = render(<MonthlySpendTrend data={[]} isLoading={true} />);
		expect(container.querySelector(".skeleton")).toBeInTheDocument();
	});

	it("renders the empty-data line of zeros without crashing", () => {
		const flat: SpendTrendPoint[] = Array.from({ length: 12 }, (_, i) => ({
			monthISO: `2025-${String(i + 1).padStart(2, "0")}`,
			monthLabel: `Month ${i + 1}`,
			totalCentavos: 0,
		}));
		render(<MonthlySpendTrend data={flat} isLoading={false} />);
		expect(screen.getByText(/Monthly Spend/i)).toBeInTheDocument();
	});
});
