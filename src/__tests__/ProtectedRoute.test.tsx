import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "../components/ProtectedRoute";

type AuthState = { session: unknown; isLoading: boolean };
const authState: AuthState = { session: null, isLoading: false };

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => authState,
}));

function renderAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route
					path="/"
					element={
						<ProtectedRoute>
							<div>Protected content</div>
						</ProtectedRoute>
					}
				/>
				<Route path="/signin" element={<div>Sign in page</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("ProtectedRoute", () => {
	beforeEach(() => {
		authState.session = null;
		authState.isLoading = false;
	});

	it("renders a loading spinner while auth is loading", () => {
		authState.isLoading = true;
		const { container } = renderAt("/");
		expect(container.querySelector(".loading-spinner")).not.toBeNull();
	});

	it("redirects to /signin when there is no session", () => {
		renderAt("/");
		expect(screen.getByText("Sign in page")).toBeInTheDocument();
	});

	it("renders children when a session exists", () => {
		authState.session = { user: { id: "u1" } };
		renderAt("/");
		expect(screen.getByText("Protected content")).toBeInTheDocument();
	});
});
