import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPreview } from "../components/landing/DashboardPreview";

describe("DashboardPreview", () => {
	it("shows the three hero figures", () => {
		render(<DashboardPreview />);
		expect(screen.getByText("Net Worth")).toBeInTheDocument();
		expect(screen.getByText("₱235,910.55")).toBeInTheDocument();
		expect(screen.getByText("Total Assets")).toBeInTheDocument();
		expect(screen.getByText("Total Liabilities")).toBeInTheDocument();
	});

	it("shows illustrative budget rows", () => {
		render(<DashboardPreview />);
		expect(screen.getByText("foods")).toBeInTheDocument();
		expect(screen.getByText("bills")).toBeInTheDocument();
		expect(screen.getByText("transpo")).toBeInTheDocument();
	});
});
