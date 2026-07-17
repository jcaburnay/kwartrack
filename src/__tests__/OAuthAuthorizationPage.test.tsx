import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPROVED_CHATGPT_CLIENT_ID, isApprovedChatGptRedirect } from "../lib/config";
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
		mocks.approveAuthorization.mockReset();
		mocks.denyAuthorization.mockReset();
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
					id: APPROVED_CHATGPT_CLIENT_ID,
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
		expect(screen.getByText(/requested by https:\/\/chatgpt.com/i)).toBeVisible();
		expect(screen.getByRole("button", { name: "Allow access" })).toBeEnabled();
	});

	it("refuses consent for an unapproved OAuth client even when it claims to be ChatGPT", async () => {
		mocks.authState.session = { user: { id: "user-1" } };
		mocks.getAuthorizationDetails.mockResolvedValue({
			data: {
				authorization_id: "request-456",
				redirect_uri: "https://attacker.example/callback",
				client: {
					id: "unapproved-client",
					name: "ChatGPT",
					uri: "https://attacker.example",
					logo_uri: "",
				},
				user: { id: "user-1", email: "user@example.com" },
				scope: "openid email profile",
			},
			error: null,
		});

		render(
			<MemoryRouter initialEntries={["/oauth/authorize?authorization_id=request-456"]}>
				<OAuthAuthorizationPage />
			</MemoryRouter>,
		);

		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Unapproved application" })).toBeVisible(),
		);
		expect(screen.getByText(/https:\/\/attacker.example/i)).toBeVisible();
		expect(screen.queryByRole("button", { name: "Allow access" })).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Deny request" })).toBeEnabled();
	});

	it("blocks an existing grant that redirects outside ChatGPT", async () => {
		mocks.authState.session = { user: { id: "user-1" } };
		mocks.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://attacker.example/callback?code=secret" },
			error: null,
		});

		render(
			<MemoryRouter initialEntries={["/oauth/authorize?authorization_id=request-789"]}>
				<OAuthAuthorizationPage />
			</MemoryRouter>,
		);

		await waitFor(() =>
			expect(screen.getByRole("heading", { name: "Couldn't connect Kwartrack" })).toBeVisible(),
		);
		expect(screen.getByText(/redirect to an unapproved application/i)).toBeVisible();
	});

	it("accepts only HTTPS redirects owned by ChatGPT", () => {
		expect(isApprovedChatGptRedirect("https://chatgpt.com/connector/oauth/callback?code=ok")).toBe(
			true,
		);
		expect(isApprovedChatGptRedirect("https://chat.openai.com/aip/callback?code=ok")).toBe(true);
		expect(isApprovedChatGptRedirect("https://chatgpt.com.attacker.example/callback")).toBe(false);
		expect(isApprovedChatGptRedirect("http://chatgpt.com/callback")).toBe(false);
	});
});
