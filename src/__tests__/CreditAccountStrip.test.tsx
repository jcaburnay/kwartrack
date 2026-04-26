import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditAccountStrip } from "../components/strips/CreditAccountStrip";
import type { Account } from "../utils/accountBalances";
import type { Recurring } from "../utils/recurringFilters";

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
		installment_limit_centavos: null,
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

function mkRecurring(over: Partial<Recurring> & { id: string }): Recurring {
	return {
		user_id: "u1",
		service: "Plan",
		description: null,
		amount_centavos: 100_00,
		type: "expense",
		tag_id: "tag1",
		from_account_id: "card1",
		to_account_id: null,
		fee_centavos: null,
		interval: "monthly",
		first_occurrence_date: "2026-01-15",
		next_occurrence_at: "2026-05-15T00:00:00Z",
		remaining_occurrences: 3,
		is_paused: false,
		is_completed: false,
		completed_at: null,
		created_at: ts,
		updated_at: ts,
		...over,
	};
}

describe("CreditAccountStrip", () => {
	it("renders only the regular utilization bar when installment_limit is null", () => {
		render(<CreditAccountStrip account={mkCard()} recurrings={[]} onPayThisCard={() => {}} />);
		const bars = screen.getAllByRole("progressbar");
		expect(bars).toHaveLength(1);
		expect(screen.queryByText(/installment/i)).not.toBeInTheDocument();
	});

	it("renders both bars and installment availability when installment_limit is set", () => {
		const card = mkCard({ installment_limit_centavos: 500_00 });
		const recurrings = [
			mkRecurring({ id: "r1", amount_centavos: 50_00, remaining_occurrences: 4 }), // 200
			mkRecurring({ id: "r2", amount_centavos: 25_00, remaining_occurrences: 4 }), // 100
		];
		render(<CreditAccountStrip account={card} recurrings={recurrings} onPayThisCard={() => {}} />);
		const bars = screen.getAllByRole("progressbar");
		expect(bars).toHaveLength(2);
		// committed = 200 + 100 = 300 of 500 → 60%
		expect(screen.getByText(/₱300\.00 \/ ₱500\.00/)).toBeInTheDocument();
		expect(screen.getByText(/60%/)).toBeInTheDocument();
		// regular bar: 250 of 1,000 → 25%, also shown as "₱250.00 / ₱1,000.00"
		expect(screen.getByText(/₱250\.00 \/ ₱1,000\.00/)).toBeInTheDocument();
		expect(screen.getByText(/25%/)).toBeInTheDocument();
		// Header still shows "Available installment ₱200.00".
		expect(screen.getByText(/200\.00/)).toBeInTheDocument();
	});

	it("shows the actual percent (not clamped) when installment is over-limit", () => {
		const card = mkCard({ installment_limit_centavos: 500_00 });
		const recurrings = [
			mkRecurring({ id: "huge", amount_centavos: 200_00, remaining_occurrences: 4 }), // 800
		];
		render(<CreditAccountStrip account={card} recurrings={recurrings} onPayThisCard={() => {}} />);
		// 800 / 500 = 160%
		expect(screen.getByText(/160%/)).toBeInTheDocument();
		expect(screen.getByText(/₱800\.00 \/ ₱500\.00/)).toBeInTheDocument();
	});

	it("Pay this card button fires the callback", async () => {
		const onPayThisCard = vi.fn();
		const user = (await import("@testing-library/user-event")).default;
		render(<CreditAccountStrip account={mkCard()} recurrings={[]} onPayThisCard={onPayThisCard} />);
		await user.click(screen.getByRole("button", { name: /pay this card/i }));
		expect(onPayThisCard).toHaveBeenCalledTimes(1);
	});
});
