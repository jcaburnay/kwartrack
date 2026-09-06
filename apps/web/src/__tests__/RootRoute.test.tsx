import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RootRoute } from "../components/RootRoute";

const mocks = vi.hoisted(() => ({
	authState: { session: null as { user: { id: string } } | null, isLoading: false },
}));

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => mocks.authState,
}));
vi.mock("../pages/JigsawPage", () => ({ JigsawPage: () => <div>APP</div> }));
vi.mock("../pages/LandingPage", () => ({ LandingPage: () => <div>LANDING</div> }));

function renderRoot() {
	render(
		<MemoryRouter>
			<RootRoute />
		</MemoryRouter>,
	);
}

describe("RootRoute", () => {
	beforeEach(() => {
		mocks.authState.session = null;
		mocks.authState.isLoading = false;
	});

	it("shows the landing page for logged-out visitors", () => {
		renderRoot();
		expect(screen.getByText("LANDING")).toBeInTheDocument();
		expect(screen.queryByText("APP")).not.toBeInTheDocument();
	});

	it("shows the app for logged-in users", async () => {
		mocks.authState.session = { user: { id: "u1" } };
		renderRoot();
		expect(await screen.findByText("APP")).toBeInTheDocument();
		expect(screen.queryByText("LANDING")).not.toBeInTheDocument();
	});

	it("shows a spinner while auth is resolving", () => {
		mocks.authState.isLoading = true;
		renderRoot();
		expect(screen.queryByText("LANDING")).not.toBeInTheDocument();
		expect(screen.queryByText("APP")).not.toBeInTheDocument();
	});
});
