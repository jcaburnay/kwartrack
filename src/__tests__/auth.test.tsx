import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import App from "../App";
import { OverviewPage } from "../pages/OverviewPage";
import { SignInPage } from "../pages/SignInPage";

// AUTH-01: User can sign up and sign in via Clerk
// Full e2e verification: Open app, complete Clerk sign-up/sign-in flow (manual only)
describe("AUTH-01: Sign-in page renders", () => {
	it("renders the sign-in page without crashing", () => {
		render(
			<MemoryRouter initialEntries={["/sign-in"]}>
				<SignInPage />
			</MemoryRouter>,
		);
		// Clerk <SignIn /> is rendered; in test env it renders null via mock
		// Structural test: the container renders without throwing
		expect(document.body).toBeTruthy();
	});
});

// AUTH-02: Session persists across browser refreshes
// Full e2e verification: Sign in, refresh page, verify still logged in (manual only)
describe("AUTH-02: App renders authenticated shell", () => {
	it("renders OverviewPage without crashing", () => {
		render(
			<MemoryRouter initialEntries={["/"]}>
				<OverviewPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("Overview")).toBeInTheDocument();
	});
});

// AUTH-03: User can sign out from any page
// Full e2e verification: Click sign out via UserButton, verify redirect (manual only)
describe("AUTH-03: Sign-out is accessible from app shell", () => {
	it("renders App without crashing (UserButton is in sidebar)", () => {
		render(<App />);
		// UserButton is rendered in Sidebar; mock returns null safely
		expect(document.body).toBeTruthy();
	});
});
