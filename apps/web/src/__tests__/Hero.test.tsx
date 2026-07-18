import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Hero } from "../components/landing/Hero";

function renderHero() {
	render(
		<MemoryRouter>
			<Hero />
		</MemoryRouter>,
	);
}

describe("Hero", () => {
	it("renders the headline and trust line", () => {
		renderHero();
		expect(screen.getByRole("heading", { name: "Every peso, clearly tracked." })).toBeInTheDocument();
		expect(screen.getByText(/No ads, no data selling/)).toBeInTheDocument();
	});

	it("sends the primary CTA to signup and the secondary to GitHub", () => {
		renderHero();
		expect(screen.getByRole("link", { name: /Get started/ })).toHaveAttribute("href", "/signup");
		expect(screen.getByRole("link", { name: /View on GitHub/ })).toHaveAttribute(
			"href",
			"https://github.com/jcaburnay/kwartrack",
		);
	});
});
