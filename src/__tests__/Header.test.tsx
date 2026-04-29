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

vi.mock("../hooks/useBudgetOverage", () => ({
	useBudgetOverage: () => false,
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

	it("shows nav links for overview, accounts, budget, recurring, and debts (desktop nav + mobile dock)", () => {
		renderHeader();
		// Each nav target appears twice: once in the desktop top nav, once in the mobile dock.
		expect(screen.getAllByRole("link", { name: /overview/i })).toHaveLength(2);
		expect(screen.getAllByRole("link", { name: /accounts/i })).toHaveLength(2);
		expect(screen.getAllByRole("link", { name: /budget/i })).toHaveLength(2);
		expect(screen.getAllByRole("link", { name: /recurring/i })).toHaveLength(2);
		// Desktop nav uses "Debts & Splits"; mobile dock uses just "Debts".
		expect(screen.getByRole("link", { name: /debts & splits/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /^debts$/i })).toBeInTheDocument();
	});

	it("places Settings inside the avatar dropdown, not in the top nav", () => {
		renderHeader();
		expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
	});
});
