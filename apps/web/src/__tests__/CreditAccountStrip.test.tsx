import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditAccountStrip } from "../components/strips/CreditAccountStrip";
import type { Account } from "../utils/accountBalances";

const ts = "2026-04-24T00:00:00Z";

function mkCard(over: Partial<Account> = {}): Account {
	return {
		id: "card1",
		user_id: "u1",
		name: "BPI Card",
		type: "credit",
		group_id: null,
		is_archived: false,
		initial_balance_centavos: 0,
		balance_centavos: 250_00,
		credit_limit_centavos: 1000_00,
		principal_centavos: null,
		interest_rate_bps: null,
		maturity_date: null,
		interest_posting_interval: null,
		interest_recurring_id: null,
		is_matured: false,
		created_at: ts,
		updated_at: ts,
		...over,
	};
}

describe("CreditAccountStrip", () => {
	it("renders the utilization bar and available credit", () => {
		render(<CreditAccountStrip account={mkCard()} onPayThisCard={() => {}} />);
		const bars = screen.getAllByRole("progressbar");
		expect(bars).toHaveLength(1);
		// available = limit - balance = 1000 - 250 = 750
		expect(screen.getByText(/₱750\.00/)).toBeInTheDocument();
		// utilization = 250 / 1,000 = 25%
		expect(screen.getByText(/₱250\.00 \/ ₱1,000\.00/)).toBeInTheDocument();
		expect(screen.getByText(/25%/)).toBeInTheDocument();
	});

	it("Pay this card button fires the callback", async () => {
		const onPayThisCard = vi.fn();
		const user = (await import("@testing-library/user-event")).default;
		render(<CreditAccountStrip account={mkCard()} onPayThisCard={onPayThisCard} />);
		await user.click(screen.getByRole("button", { name: /pay this card/i }));
		expect(onPayThisCard).toHaveBeenCalledTimes(1);
	});
});
