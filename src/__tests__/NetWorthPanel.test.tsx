import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetWorthPanel } from "../components/panels/NetWorthPanel";

vi.mock("../hooks/useAccounts", () => ({
	useAccounts: () => ({ accounts: [], isLoading: false }),
}));

vi.mock("../hooks/useMtdDelta", () => ({
	useMtdDelta: () => ({ deltaCentavos: 0, percentOfCurrent: 0 }),
}));

vi.mock("../hooks/useNetWorthTrend", () => ({
	useNetWorthTrend: () => ({ trend: [], isLoading: false }),
}));

vi.mock("../hooks/useCashFlowTrend", () => ({
	useCashFlowTrend: () => ({ trend: [], isLoading: false }),
}));

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({ profile: { timezone: "Asia/Manila" } }),
}));

vi.mock("../components/overview/NetWorthTrend", () => ({
	NetWorthTrend: () => <div data-testid="net-worth-trend" />,
}));

vi.mock("../components/overview/CashFlowTrend", () => ({
	CashFlowTrend: () => <div data-testid="cash-flow-trend" />,
}));

vi.mock("../components/overview/AssetMix", () => ({
	AssetMix: () => <div data-testid="asset-mix" />,
}));

vi.mock("../components/overview/AccountBalancesBar", () => ({
	AccountBalancesBar: () => <div data-testid="account-balances" />,
}));

describe("NetWorthPanel", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("persists the selected chart view and range across remounts", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<NetWorthPanel />);

		await user.selectOptions(screen.getByLabelText(/chart view/i), "cashFlow");
		await user.click(screen.getByRole("radio", { name: "6M" }));

		unmount();
		render(<NetWorthPanel />);

		expect(screen.getByLabelText(/chart view/i)).toHaveValue("cashFlow");
		expect(screen.getByRole("radio", { name: "6M" })).toBeChecked();
	});
});
