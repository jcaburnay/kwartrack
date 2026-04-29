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

	it("has no top-level feature nav links (jigsaw is the single page)", () => {
		renderHeader();
		// Header no longer has per-feature nav links — the jigsaw page shows everything.
		// Mobile dock uses scroll buttons (not NavLinks), so no feature links at all in header.
		expect(screen.queryByRole("link", { name: /^overview$/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /^accounts$/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /^budget$/i })).not.toBeInTheDocument();
	});

	it("places Settings inside the avatar dropdown", () => {
		renderHeader();
		expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
	});
});
