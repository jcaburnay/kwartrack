import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SocialAuthButtons } from "../pages/auth/SocialAuthButtons";

const signInWithOAuth = vi.fn();

vi.mock("../lib/supabase", () => ({
	supabase: {
		auth: {
			signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
		},
	},
}));

describe("SocialAuthButtons", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		signInWithOAuth.mockReset();
	});

	it("hides Google authentication when the provider is disabled", () => {
		vi.stubEnv("VITE_GOOGLE_AUTH_ENABLED", "false");

		render(<SocialAuthButtons setError={vi.fn()} />);

		expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument();
		expect(screen.queryByText(/^or$/i)).not.toBeInTheDocument();
	});

	it("offers Google authentication when the provider is enabled", async () => {
		vi.stubEnv("VITE_GOOGLE_AUTH_ENABLED", "true");
		signInWithOAuth.mockResolvedValueOnce({ error: null });

		render(<SocialAuthButtons setError={vi.fn()} redirectPath="/settings" />);
		await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

		expect(signInWithOAuth).toHaveBeenCalledWith({
			provider: "google",
			options: { redirectTo: `${window.location.origin}/settings` },
		});
	});
});
