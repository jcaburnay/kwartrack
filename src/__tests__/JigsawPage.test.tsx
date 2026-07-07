import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JigsawPage } from "../pages/JigsawPage";

vi.mock("../components/Header", () => ({
	Header: () => <header data-testid="app-header" />,
}));

vi.mock("../components/panels/NetWorthPanel", () => ({
	NetWorthPanel: () => <section data-testid="networth-panel" />,
}));

vi.mock("../components/panels/AccountsPanel", () => ({
	AccountsPanel: () => <section data-testid="accounts-panel" />,
}));

vi.mock("../components/panels/RecurringPanel", () => ({
	RecurringPanel: () => <section data-testid="recurring-panel" />,
}));

vi.mock("../components/panels/BudgetPanel", () => ({
	BudgetPanel: () => <section data-testid="budget-panel" />,
}));

vi.mock("../components/panels/DebtsPanel", () => ({
	DebtsPanel: () => <section data-testid="debts-panel" />,
}));

function setDesktopMedia(matches: boolean) {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: query.includes("min-width: 1024px") ? matches : false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}

function renderJigsaw(path = "/") {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<JigsawPage />
		</MemoryRouter>,
	);
}

describe("JigsawPage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("mounts only the active panel below the desktop breakpoint", () => {
		setDesktopMedia(false);

		renderJigsaw("/?panel=accounts");

		expect(screen.getByTestId("accounts-panel")).toBeInTheDocument();
		expect(screen.queryByTestId("networth-panel")).not.toBeInTheDocument();
		expect(screen.queryByTestId("recurring-panel")).not.toBeInTheDocument();
		expect(screen.queryByTestId("budget-panel")).not.toBeInTheDocument();
		expect(screen.queryByTestId("debts-panel")).not.toBeInTheDocument();
	});

	it("mounts every panel at the desktop breakpoint", () => {
		setDesktopMedia(true);

		renderJigsaw("/?panel=accounts");

		expect(screen.getByTestId("networth-panel")).toBeInTheDocument();
		expect(screen.getByTestId("accounts-panel")).toBeInTheDocument();
		expect(screen.getByTestId("recurring-panel")).toBeInTheDocument();
		expect(screen.getByTestId("budget-panel")).toBeInTheDocument();
		expect(screen.getByTestId("debts-panel")).toBeInTheDocument();
	});
});
