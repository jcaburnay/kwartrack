import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WelcomeCard } from "../components/WelcomeCard";

describe("WelcomeCard", () => {
	it("renders the welcome heading and description", () => {
		render(<WelcomeCard onCreateAccount={() => {}} />);
		expect(screen.getByText(/Welcome to Kwartrack/)).toBeInTheDocument();
		expect(screen.getByText(/Get started by creating your first account/i)).toBeInTheDocument();
	});

	it("calls onCreateAccount when the CTA is clicked", async () => {
		const onCreate = vi.fn();
		render(<WelcomeCard onCreateAccount={onCreate} />);
		await userEvent.click(screen.getByRole("button", { name: /Create Account/i }));
		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it("does not show the disabled disclaimer line", () => {
		render(<WelcomeCard onCreateAccount={() => {}} />);
		expect(screen.queryByText(/arrives in a later slice/i)).not.toBeInTheDocument();
	});
});
