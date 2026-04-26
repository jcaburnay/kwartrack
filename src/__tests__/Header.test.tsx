import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
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

vi.mock("../hooks/useDebtsAndSplits", () => ({
	useDebtsAndSplits: () => ({
		debts: [],
		splits: [],
		balance: { owedCentavos: 0, oweCentavos: 0 },
		hasUnsettledLoaned: false,
		isLoading: false,
		error: null,
	}),
}));

function renderHeader() {
	return render(
		<MemoryRouter>
			<Header />
		</MemoryRouter>,
	);
}

describe("Header", () => {
	beforeEach(() => {
		signOut.mockReset();
	});

	it("renders the user's display name and initials", () => {
		renderHeader();
		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		expect(screen.getByText("JD")).toBeInTheDocument();
	});

	it("calls signOut when the button is clicked", async () => {
		renderHeader();
		await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalledTimes(1);
	});

	it("shows nav links for overview, accounts, budget, recurring, debts & splits, settings", () => {
		renderHeader();
		expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /accounts/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /budget/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /recurring/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /debts & splits/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
	});
});
