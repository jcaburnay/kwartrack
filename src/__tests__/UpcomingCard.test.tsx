import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { UpcomingCard } from "../components/overview/UpcomingCard";
import type { UpcomingItem } from "../utils/overviewAggregation";

function renderCard(items: UpcomingItem[], isLoading = false) {
	return render(
		<MemoryRouter>
			<UpcomingCard items={items} isLoading={isLoading} />
		</MemoryRouter>,
	);
}

describe("UpcomingCard", () => {
	it("shows the all-caught-up empty state when items is empty", () => {
		renderCard([]);
		expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
	});

	it("shows skeleton when isLoading and items is empty", () => {
		const { container } = renderCard([], true);
		expect(container.querySelector(".skeleton")).toBeInTheDocument();
	});

	it("renders a recurring item with route to /recurring", () => {
		renderCard([
			{
				kind: "recurring",
				id: "r1",
				service: "Spotify",
				amountCentavos: 279_00,
				daysAway: 3,
			},
		]);
		expect(screen.getByText(/Spotify/)).toBeInTheDocument();
		expect(screen.getByRole("link")).toHaveAttribute("href", "/recurring");
	});

	it("renders a loaned-debt item with route to /debts-and-splits", () => {
		renderCard([
			{
				kind: "loaned-debt",
				id: "d1",
				personName: "Alice",
				remainingCentavos: 960_00,
				daysOld: 14,
				debtDateISO: "2026-04-01",
			},
		]);
		expect(screen.getByText(/Alice/)).toBeInTheDocument();
		expect(screen.getByRole("link")).toHaveAttribute("href", "/debts-and-splits");
	});

	it("renders a budget-warning item with route to /budget", () => {
		renderCard([
			{
				kind: "budget-warning",
				tagId: "t1",
				tagName: "foods",
				pct: 0.87,
				daysLeftInMonth: 12,
			},
		]);
		expect(screen.getByText(/foods/)).toBeInTheDocument();
		expect(screen.getByText(/87%/)).toBeInTheDocument();
		expect(screen.getByRole("link")).toHaveAttribute("href", "/budget");
	});

	it("preserves the order of items (caller controls ordering)", () => {
		renderCard([
			{ kind: "recurring", id: "r1", service: "Netflix", amountCentavos: 100_00, daysAway: 1 },
			{
				kind: "loaned-debt",
				id: "d1",
				personName: "Alice",
				remainingCentavos: 100_00,
				daysOld: 30,
				debtDateISO: "2026-03-15",
			},
			{ kind: "budget-warning", tagId: "t1", tagName: "foods", pct: 0.87, daysLeftInMonth: 12 },
		]);
		const links = screen.getAllByRole("link");
		expect(links[0]).toHaveTextContent(/Netflix/);
		expect(links[1]).toHaveTextContent(/Alice/);
		expect(links[2]).toHaveTextContent(/foods/);
	});
});
