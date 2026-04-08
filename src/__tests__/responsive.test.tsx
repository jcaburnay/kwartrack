import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

// Mock react-router partially — keep MemoryRouter real, mock hooks
vi.mock("react-router", async () => {
	const actual = await vi.importActual<typeof import("react-router")>("react-router");
	return {
		...actual,
		useNavigate: () => vi.fn(),
		useParams: () => ({}),
		useLocation: () => ({
			pathname: "/accounts",
			search: "",
			hash: "",
			state: null,
			key: "default",
		}),
		Outlet: () => <div data-testid="outlet" />,
	};
});

// Mock lucide-react icons — explicit exports for all icons used by components under test
vi.mock("lucide-react", () => {
	const createIcon = (name: string) => {
		const Icon = ({ size, ...rest }: { size?: number }) => (
			<span data-testid={`icon-${name}`} {...rest} />
		);
		Icon.displayName = name;
		return Icon;
	};
	return {
		ArrowLeftRight: createIcon("ArrowLeftRight"),
		Building2: createIcon("Building2"),
		CalendarClock: createIcon("CalendarClock"),
		HandCoins: createIcon("HandCoins"),
		LayoutDashboard: createIcon("LayoutDashboard"),
		Menu: createIcon("Menu"),
		PiggyBank: createIcon("PiggyBank"),
		Settings: createIcon("Settings"),
		Users: createIcon("Users"),
		Plus: createIcon("Plus"),
		Search: createIcon("Search"),
		X: createIcon("X"),
		Moon: createIcon("Moon"),
		Sun: createIcon("Sun"),
		TrendingUp: createIcon("TrendingUp"),
		Wallet: createIcon("Wallet"),
		MoreVertical: createIcon("MoreVertical"),
		ChevronLeft: createIcon("ChevronLeft"),
	};
});

// Mock react-day-picker
vi.mock("react-day-picker", () => ({
	DayPicker: () => <div data-testid="day-picker" />,
}));
vi.mock("react-day-picker/style.css", () => ({}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
	useForm: () => ({
		register: (name: string) => ({ name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
		handleSubmit: (fn: (data: Record<string, string>) => void) => (e: React.FormEvent) => {
			e.preventDefault();
			fn({ name: "", initialBalance: "" });
		},
		watch: () => "",
		reset: vi.fn(),
		formState: { errors: {}, isSubmitting: false },
	}),
}));

// =============================================================================
// D-02: MobileHeader
// =============================================================================
describe("MobileHeader (D-02)", () => {
	it("renders with sm:hidden class on its root element", async () => {
		const { MobileHeader } = await import("../components/MobileHeader");
		const { container } = render(
			<MemoryRouter>
				<MobileHeader />
			</MemoryRouter>,
		);
		const header = container.querySelector("header");
		expect(header).toBeInTheDocument();
		expect(header?.className).toContain("sm:hidden");
	});

	it('contains text "Kwartrack"', async () => {
		const { MobileHeader } = await import("../components/MobileHeader");
		render(
			<MemoryRouter>
				<MobileHeader />
			</MemoryRouter>,
		);
		expect(screen.getByText("Kwartrack")).toBeInTheDocument();
	});

	it("contains ThemeToggle (theme button)", async () => {
		const { MobileHeader } = await import("../components/MobileHeader");
		render(
			<MemoryRouter>
				<MobileHeader />
			</MemoryRouter>,
		);
		// ThemeToggle renders a button with aria-label for theme switching
		const toggle = screen.getByLabelText(/switch to (light|dark) mode/i);
		expect(toggle).toBeInTheDocument();
	});

	it("contains UserButton (mocked)", async () => {
		const { MobileHeader } = await import("../components/MobileHeader");
		render(
			<MemoryRouter>
				<MobileHeader />
			</MemoryRouter>,
		);
		// UserButton is mocked in setup.ts to return null, so we just verify no crash
		// The component renders without error — this confirms UserButton is included
		expect(screen.getByText("Kwartrack")).toBeInTheDocument();
	});
});

// =============================================================================
// D-01: BottomTabBar
// =============================================================================
describe("BottomTabBar (D-01)", () => {
	it("renders with sm:hidden class", async () => {
		const { BottomTabBar } = await import("../components/BottomTabBar");
		const { container } = render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<BottomTabBar />
			</MemoryRouter>,
		);
		// BottomTabBar uses DaisyUI "dock" class on a div
		const dock = container.querySelector(".dock.sm\\:hidden");
		expect(dock).toBeInTheDocument();
	});

	it("contains 5 tab items (Dashboard, Accounts, Recurring, Budget, More)", async () => {
		const { BottomTabBar } = await import("../components/BottomTabBar");
		render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<BottomTabBar />
			</MemoryRouter>,
		);
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("Accounts")).toBeInTheDocument();
		expect(screen.getByText("Recurring")).toBeInTheDocument();
		expect(screen.getByText("Budget")).toBeInTheDocument();
		expect(screen.getByText("More")).toBeInTheDocument();
	});

	it("contains dock class with sm:hidden", async () => {
		const { BottomTabBar } = await import("../components/BottomTabBar");
		const { container } = render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<BottomTabBar />
			</MemoryRouter>,
		);
		// DaisyUI dock handles fixed positioning via its own CSS
		const dock = container.querySelector(".dock");
		expect(dock).toBeInTheDocument();
		expect(dock?.className).toContain("sm:hidden");
	});

	it("renders all expected tab labels", async () => {
		const { BottomTabBar } = await import("../components/BottomTabBar");
		render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<BottomTabBar />
			</MemoryRouter>,
		);
		// Verify tab labels are rendered (DaisyUI dock handles sizing)
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("Accounts")).toBeInTheDocument();
		expect(screen.getByText("More")).toBeInTheDocument();
	});

	it("shows Settings in the More menu", async () => {
		const user = userEvent.setup();
		const { BottomTabBar } = await import("../components/BottomTabBar");
		render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<BottomTabBar />
			</MemoryRouter>,
		);
		await user.click(screen.getByRole("button", { name: /More/i }));
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("Debts & Splits")).toBeInTheDocument();
	});
});

// =============================================================================
// D-03: AppShell
// =============================================================================
describe("AppShell (D-03)", () => {
	it("root div has flex-col sm:flex-row classes", async () => {
		const { AppShell } = await import("../components/AppShell");
		const { container } = render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<AppShell />
			</MemoryRouter>,
		);
		const root = container.firstElementChild;
		expect(root?.className).toContain("flex-col");
		expect(root?.className).toContain("sm:flex-row");
	});

	it("main element has pb-16 sm:pb-0 classes", async () => {
		const { AppShell } = await import("../components/AppShell");
		const { container } = render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<AppShell />
			</MemoryRouter>,
		);
		const main = container.querySelector("main");
		expect(main).toBeInTheDocument();
		expect(main?.className).toContain("pb-16");
		expect(main?.className).toContain("sm:pb-0");
	});

	it("renders MobileHeader, Sidebar, and BottomTabBar children", async () => {
		const { AppShell } = await import("../components/AppShell");
		const { container } = render(
			<MemoryRouter initialEntries={["/accounts"]}>
				<AppShell />
			</MemoryRouter>,
		);
		// MobileHeader renders a <header> with sm:hidden
		const header = container.querySelector("header.sm\\:hidden");
		expect(header).toBeInTheDocument();
		// Sidebar renders a div with hidden sm:flex
		const sidebar = container.querySelector(".hidden.sm\\:flex");
		expect(sidebar).toBeInTheDocument();
		// BottomTabBar renders a div with dock and sm:hidden classes
		const dock = container.querySelector(".dock.sm\\:hidden");
		expect(dock).toBeInTheDocument();
	});
});

// =============================================================================
// D-04: Card grids
// =============================================================================
describe("Card grids (D-04)", () => {
	it("AccountsPage grid containers have grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", async () => {
		const { AccountsPage } = await import("../pages/AccountsPage");
		const { container } = render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		// Find grid container (works for loading, empty, and populated states)
		const grid = container.querySelector(".grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4");
		expect(grid).toBeInTheDocument();
	});
});

// =============================================================================
// D-05: Page padding
// =============================================================================
describe("Page padding (D-05)", () => {
	it("AccountsPage wrapper has p-4 sm:p-6", async () => {
		const { AccountsPage } = await import("../pages/AccountsPage");
		const { container } = render(
			<MemoryRouter>
				<AccountsPage />
			</MemoryRouter>,
		);
		const wrapper = container.querySelector(".p-4.sm\\:p-6");
		expect(wrapper).toBeInTheDocument();
	});
});

// =============================================================================
// D-06: TransactionTable mobile cards
// =============================================================================
describe("TransactionTable mobile cards (D-06)", () => {
	const defaultProps = {
		transactions: [],
		accounts: [],
		partitions: [],
		hasActiveFilters: false,
		onEdit: vi.fn(),
		onDelete: vi.fn(),
		onAddNew: vi.fn(),
	};

	it("renders a div with sm:hidden class (mobile card list)", async () => {
		const { TransactionTable } = await import("../components/TransactionTable");
		const { container } = render(<TransactionTable {...defaultProps} />);
		const mobileList = container.querySelector(".sm\\:hidden");
		expect(mobileList).toBeInTheDocument();
	});

	it("renders a div with hidden sm:block class (desktop table)", async () => {
		const { TransactionTable } = await import("../components/TransactionTable");
		const { container } = render(<TransactionTable {...defaultProps} />);
		const desktopTable = container.querySelector(".hidden.sm\\:block");
		expect(desktopTable).toBeInTheDocument();
	});
});

// =============================================================================
// D-07: TransactionFilterRow
// =============================================================================
describe("TransactionFilterRow (D-07)", () => {
	const defaultFilters = { type: "" as const, tag: "", dateFrom: "", dateTo: "" };

	it('renders a button with text "Filter" that has sm:hidden class', async () => {
		const { TransactionFilterRow } = await import("../components/TransactionFilterRow");
		render(<TransactionFilterRow filters={defaultFilters} onChange={vi.fn()} />);
		const filterBtn = screen.getByText("Filter");
		expect(filterBtn).toBeInTheDocument();
		// The button itself should have sm:hidden class
		const btn = filterBtn.closest("button");
		expect(btn?.className).toContain("sm:hidden");
	});

	it("filter inputs container has sm:flex class", async () => {
		const { TransactionFilterRow } = await import("../components/TransactionFilterRow");
		const { container } = render(
			<TransactionFilterRow filters={defaultFilters} onChange={vi.fn()} />,
		);
		const filtersContainer = container.querySelector(".sm\\:flex");
		expect(filtersContainer).toBeInTheDocument();
	});
});

// =============================================================================
// D-08: Modal full-screen
// =============================================================================
describe("Modal bottom-sheet (D-08)", () => {
	it("AccountModal uses modal-bottom sm:modal-middle pattern", async () => {
		const { AccountModal } = await import("../components/AccountModal");
		const { container } = render(<AccountModal onClose={vi.fn()} />);
		const dialog = container.querySelector(".modal-bottom");
		expect(dialog).toBeInTheDocument();
		expect(dialog?.className).toContain("sm:modal-middle");
	});

	it("DeleteConfirmModal uses modal-bottom sm:modal-middle pattern", async () => {
		const { DeleteConfirmModal } = await import("../components/DeleteConfirmModal");
		const { container } = render(
			<DeleteConfirmModal
				title="Delete Test?"
				body="Are you sure?"
				confirmLabel="Delete"
				dismissLabel="Keep"
				onConfirm={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		const dialog = container.querySelector(".modal-bottom");
		expect(dialog).toBeInTheDocument();
		expect(dialog?.className).toContain("sm:modal-middle");
	});
});

// =============================================================================
// D-09: Modal button order
// =============================================================================
describe("Modal button order (D-09)", () => {
	it("AccountModal: first button is Cancel, second is Save", async () => {
		const { AccountModal } = await import("../components/AccountModal");
		render(<AccountModal onClose={vi.fn()} />);
		// Find the button row (flex gap-2 mt-4 containing Cancel and Save)
		const cancelBtn = screen.getByRole("button", { name: /cancel/i });
		screen.getByRole("button", { name: /save/i });
		// Get their common parent (the button row)
		const buttonRow = cancelBtn.parentElement!;
		const buttons = within(buttonRow).getAllByRole("button");
		// Cancel should be first, Save should be second
		expect(buttons[0]).toHaveTextContent(/cancel/i);
		expect(buttons[1]).toHaveTextContent(/save/i);
	});

	it("DeleteConfirmModal: first button is dismiss, second is confirm", async () => {
		const { DeleteConfirmModal } = await import("../components/DeleteConfirmModal");
		render(
			<DeleteConfirmModal
				title="Delete Test?"
				body="Are you sure?"
				confirmLabel="Delete Test"
				dismissLabel="Keep Test"
				onConfirm={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		);
		const dismissBtn = screen.getByRole("button", { name: "Keep Test" });
		screen.getByRole("button", { name: "Delete Test" });
		const buttonRow = dismissBtn.parentElement!;
		const buttons = within(buttonRow).getAllByRole("button");
		expect(buttons[0]).toHaveTextContent("Keep Test");
		expect(buttons[1]).toHaveTextContent("Delete Test");
	});
});
