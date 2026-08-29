import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingNav } from "../components/landing/LandingNav";

const mocks = vi.hoisted(() => ({
	theme: "light" as string,
	setTheme: vi.fn(),
}));

vi.mock("../hooks/useTheme", () => ({
	useTheme: () => ({ theme: mocks.theme, setTheme: mocks.setTheme }),
	resolveTheme: (t: string) => t,
	THEMES: [],
}));

function renderNav() {
	render(
		<MemoryRouter>
			<LandingNav />
		</MemoryRouter>,
	);
}

describe("LandingNav", () => {
	beforeEach(() => {
		mocks.theme = "light";
		mocks.setTheme.mockReset();
	});

	it("links sign-in and get-started to the auth routes", () => {
		renderNav();
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
		expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
	});

	it("switches to the business theme when currently light", () => {
		renderNav();
		screen.getByRole("button", { name: /theme/i }).click();
		expect(mocks.setTheme).toHaveBeenCalledWith("business");
	});

	it("switches to the corporate theme when currently dark", () => {
		mocks.theme = "business";
		renderNav();
		screen.getByRole("button", { name: /theme/i }).click();
		expect(mocks.setTheme).toHaveBeenCalledWith("corporate");
	});
});
