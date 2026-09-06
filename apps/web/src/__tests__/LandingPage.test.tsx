import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "../pages/LandingPage";

vi.mock("../hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
	resolveTheme: (t: string) => t,
	THEMES: [],
}));

describe("LandingPage", () => {
	it("renders the hero, features, and self-host paths", () => {
		render(
			<MemoryRouter>
				<LandingPage />
			</MemoryRouter>,
		);
		expect(
			screen.getByRole("heading", { name: "Every peso, clearly tracked." }),
		).toBeInTheDocument();
		expect(screen.getByText("Time deposits")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: /Your money\. Your data\./ })).toBeInTheDocument();
	});

	it("has at least one signup CTA", () => {
		render(
			<MemoryRouter>
				<LandingPage />
			</MemoryRouter>,
		);
		const signupLinks = screen
			.getAllByRole("link")
			.filter((el) => el.getAttribute("href") === "/signup");
		expect(signupLinks.length).toBeGreaterThan(0);
	});
});
