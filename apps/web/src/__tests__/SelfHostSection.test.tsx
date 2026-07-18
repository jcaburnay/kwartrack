import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SelfHostSection } from "../components/landing/SelfHostSection";

describe("SelfHostSection", () => {
	it("offers both hosted and self-hosted paths", () => {
		render(
			<MemoryRouter>
				<SelfHostSection />
			</MemoryRouter>,
		);
		expect(screen.getByRole("link", { name: /Get started/ })).toHaveAttribute("href", "/signup");
		expect(screen.getByRole("link", { name: /Self-host guide/ })).toHaveAttribute(
			"href",
			"https://github.com/jcaburnay/kwartrack#self-hosting",
		);
	});
});
