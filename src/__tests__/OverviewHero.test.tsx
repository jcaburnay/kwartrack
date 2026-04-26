import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { OverviewHero } from "../components/overview/OverviewHero";
import type { Account } from "../utils/accountBalances";

function mkAccount(
	p: Partial<Account> & Pick<Account, "id" | "type" | "balance_centavos">,
): Account {
	const defaults: Account = {
		user_id: "u1",
		group_id: null,
		id: p.id,
		name: p.id,
		initial_balance_centavos: p.balance_centavos,
		balance_centavos: p.balance_centavos,
		type: p.type,
		is_archived: false,
		credit_limit_centavos: p.type === "credit" ? 100_000_00 : null,
		installment_limit_centavos: null,
		principal_centavos: null,
		interest_rate_bps: null,
		maturity_date: null,
		interest_posting_interval: null,
		interest_recurring_id: null,
		is_matured: false,
		created_at: "2026-04-01T00:00:00Z",
		updated_at: "2026-04-01T00:00:00Z",
	};
	return { ...defaults, ...p };
}

function renderHero(accounts: Account[], isLoading = false) {
	return render(
		<MemoryRouter>
			<OverviewHero accounts={accounts} isLoading={isLoading} />
		</MemoryRouter>,
	);
}

describe("OverviewHero", () => {
	it("renders three cards: Assets / Liabilities / Net Worth", () => {
		renderHero([
			mkAccount({ id: "a1", type: "savings", balance_centavos: 100_000_00 }),
			mkAccount({ id: "a2", type: "credit", balance_centavos: 30_000_00 }),
		]);
		expect(screen.getByText("Total Assets")).toBeInTheDocument();
		expect(screen.getByText("Total Liabilities")).toBeInTheDocument();
		expect(screen.getByText("Net Worth")).toBeInTheDocument();
	});

	it("links Assets and Net Worth to /accounts; Liabilities to /accounts?type=credit", () => {
		renderHero([mkAccount({ id: "a1", type: "savings", balance_centavos: 100_000_00 })]);
		expect(screen.getByRole("link", { name: /Total Assets/ })).toHaveAttribute("href", "/accounts");
		expect(screen.getByRole("link", { name: /Total Liabilities/ })).toHaveAttribute(
			"href",
			"/accounts?type=credit",
		);
		expect(screen.getByRole("link", { name: /Net Worth/ })).toHaveAttribute("href", "/accounts");
	});

	it("renders ₱0 across the board when accounts list is empty", () => {
		renderHero([]);
		const zeros = screen.getAllByText(/₱0/);
		expect(zeros.length).toBeGreaterThanOrEqual(3);
	});

	it("styles negative net worth with text-error", () => {
		const { container } = renderHero([
			mkAccount({ id: "a1", type: "credit", balance_centavos: 50_000_00 }),
		]);
		const netCard = container.querySelector('a[href="/accounts"][data-overview-card="net"]');
		expect(netCard?.querySelector(".text-error")).toBeInTheDocument();
	});

	it("renders skeleton placeholders when isLoading and no accounts yet", () => {
		const { container } = renderHero([], true);
		expect(container.querySelectorAll(".skeleton").length).toBeGreaterThanOrEqual(3);
	});
});
