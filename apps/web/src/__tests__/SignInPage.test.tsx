import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "../pages/AuthPage";

const signIn = vi.fn();
const setSessionOptimistically = vi.fn();

vi.mock("../lib/supabase", () => ({
	supabase: {
		auth: {
			signInWithPassword: (...args: unknown[]) => signIn(...args),
		},
	},
}));

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({
		session: null,
		isLoading: false,
		setSessionOptimistically,
	}),
}));

function renderPage() {
	return render(
		<MemoryRouter initialEntries={["/signin"]}>
			<AuthPage />
		</MemoryRouter>,
	);
}

describe("AuthPage — sign in tab", () => {
	beforeEach(() => {
		signIn.mockReset();
		setSessionOptimistically.mockReset();
	});

	it("blocks submit with empty fields", async () => {
		renderPage();
		await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
		expect(screen.getByText(/password is required/i)).toBeInTheDocument();
		expect(signIn).not.toHaveBeenCalled();
	});

	it("surfaces Supabase errors", async () => {
		signIn.mockResolvedValueOnce({
			data: { session: null },
			error: { message: "Invalid login credentials" },
		});
		renderPage();
		await userEvent.type(screen.getByLabelText(/email/i), "jane@test.dev");
		await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
		await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText(/email or password is incorrect/i)).toBeInTheDocument();
		expect(setSessionOptimistically).not.toHaveBeenCalled();
	});

	it("seeds the session on successful sign-in", async () => {
		signIn.mockResolvedValueOnce({
			data: { session: { user: { id: "u1" } } },
			error: null,
		});
		renderPage();
		await userEvent.type(screen.getByLabelText(/email/i), "jane@test.dev");
		await userEvent.type(screen.getByLabelText(/password/i), "password123");
		await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(setSessionOptimistically).toHaveBeenCalledWith({ user: { id: "u1" } });
	});
});
