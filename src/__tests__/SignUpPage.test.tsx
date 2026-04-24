import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpPage } from "../pages/SignUpPage";

const signUp = vi.fn();
const setSessionOptimistically = vi.fn();

vi.mock("../lib/supabase", () => ({
	supabase: {
		auth: {
			signUp: (...args: unknown[]) => signUp(...args),
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
		<MemoryRouter>
			<SignUpPage />
		</MemoryRouter>,
	);
}

describe("SignUpPage", () => {
	beforeEach(() => {
		signUp.mockReset();
		setSessionOptimistically.mockReset();
	});

	it("shows validation errors when fields are empty on submit", async () => {
		renderPage();
		await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));
		expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();
		expect(screen.getByText(/email is required/i)).toBeInTheDocument();
		expect(screen.getByText(/password is required/i)).toBeInTheDocument();
		expect(signUp).not.toHaveBeenCalled();
	});

	it("rejects bad emails and short passwords", async () => {
		renderPage();
		await userEvent.type(screen.getByLabelText(/display name/i), "Ok");
		await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
		await userEvent.type(screen.getByLabelText(/password/i), "abc");
		await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));
		expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
		expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
		expect(signUp).not.toHaveBeenCalled();
	});

	it("calls supabase.auth.signUp with form data and seeds the session", async () => {
		signUp.mockResolvedValueOnce({
			data: { session: { user: { id: "u1" } } },
			error: null,
		});
		renderPage();
		await userEvent.type(screen.getByLabelText(/display name/i), "Jane");
		await userEvent.type(screen.getByLabelText(/email/i), "jane@test.dev");
		await userEvent.type(screen.getByLabelText(/password/i), "password123");
		await userEvent.click(screen.getByRole("button", { name: /^sign up$/i }));

		expect(signUp).toHaveBeenCalledTimes(1);
		const [args] = signUp.mock.calls[0];
		expect(args).toMatchObject({
			email: "jane@test.dev",
			password: "password123",
			options: { data: { display_name: "Jane" } },
		});
		expect(setSessionOptimistically).toHaveBeenCalledWith({ user: { id: "u1" } });
	});
});
