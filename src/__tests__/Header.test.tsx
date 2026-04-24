import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "../components/Header";

const signOut = vi.fn();
const authMock = {
	profile: { display_name: "Jane Doe" },
	signOut,
};

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => authMock,
}));

describe("Header", () => {
	beforeEach(() => {
		signOut.mockReset();
	});

	it("renders the user's display name and initials", () => {
		render(<Header />);
		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		expect(screen.getByText("JD")).toBeInTheDocument();
	});

	it("calls signOut when the button is clicked", async () => {
		render(<Header />);
		await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalledTimes(1);
	});
});
