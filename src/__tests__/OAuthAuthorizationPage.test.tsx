import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthAuthorizationPage } from "../pages/OAuthAuthorizationPage";

const mocks = vi.hoisted(() => ({
	authState: { session: null as { user: { id: string } } | null, isLoading: false },
	getAuthorizationDetails: vi.fn(),
	approveAuthorization: vi.fn(),
	denyAuthorization: vi.fn(),
}));

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => mocks.authState,
}));

vi.mock("../lib/supabase", () => ({
	supabase: {
		auth: {
			oauth: {
				getAuthorizationDetails: mocks.getAuthorizationDetails,
				approveAuthorization: mocks.approveAuthorization,
				denyAuthorization: mocks.denyAuthorization,
			},
		},
	},
}));

describe("OAuthAuthorizationPage", () => {
	beforeEach(() => {
		mocks.authState.session = null;
		mocks.authState.isLoading = false;
		mocks.getAuthorizationDetails.mockReset();
	});

	it("preserves the authorization request when asking a signed-out user to sign in", () => {
		render(
			<MemoryRouter initialEntries={["/oauth/authorize?authorization_id=request-123"]}>
				<OAuthAuthorizationPage />
			</MemoryRouter>,
		);

		const link = screen.getByRole("link", { name: "Sign in to continue" });
		expect(link).toHaveAttribute(
			"href",
			"/signin?next=%2Foauth%2Fauthorize%3Fauthorization_id%3Drequest-123",
		);
		expect(mocks.getAuthorizationDetails).not.toHaveBeenCalled();
	});

	it("shows the requesting client and makes the read-only boundary explicit", async () => {
		mocks.authState.session = { user: { id: "user-1" } };
		mocks.getAuthorizationDetails.mockResolvedValue({
			data: {
				authorization_id: "request-123",
				redirect_uri: "https://chatgpt.com/connector/oauth/callback-1",
				client: {
					id: "client-1",
					name: "ChatGPT",
					uri: "https://chatgpt.com",
					logo_uri: "",
				},
				user: { id: "user-1", email: "user@example.com" },
				scope: "openid email profile",
			},
			error: null,
		});

		render(
			<MemoryRouter initialEntries={["/oauth/authorize?authorization_id=request-123"]}>
				<OAuthAuthorizationPage />
			</MemoryRouter>,
		);

		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Connect ChatGPT" })).toBeVisible(),
		);
		expect(screen.getByText(/integration is read-only/i)).toBeVisible();
		expect(screen.getByRole("button", { name: "Allow access" })).toBeEnabled();
	});
});
