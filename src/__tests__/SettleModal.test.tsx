import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettleModal } from "../components/debts/SettleModal";
import type { Account } from "../utils/accountBalances";

const accounts = [
	{
		id: "a1",
		name: "Cash",
		type: "cash",
		is_archived: false,
	},
	{
		id: "a2",
		name: "Maya",
		type: "e-wallet",
		is_archived: false,
	},
] as unknown as Account[];

describe("SettleModal", () => {
	it("calls onSubmit with the entered amount + account + date", async () => {
		const onSubmit = vi.fn().mockResolvedValue({ error: null });
		render(
			<SettleModal
				personName="Alice"
				direction="loaned"
				amountCentavos={50000}
				settledCentavos={20000}
				suggestedAccountId={null}
				accounts={accounts}
				groups={[]}
				onSubmit={onSubmit}
				onCancel={() => {}}
			/>,
		);
		// Default amount = remaining = 300 pesos.
		fireEvent.change(screen.getByLabelText(/Paid to/i), { target: { value: "a1" } });
		fireEvent.click(screen.getByRole("button", { name: /Record/i }));
		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
		const call = onSubmit.mock.calls[0][0];
		expect(call.amountCentavos).toBe(30000);
		expect(call.paidAccountId).toBe("a1");
	});

	it("'Pay in full' fills the remaining amount", () => {
		render(
			<SettleModal
				personName="Alice"
				direction="loaned"
				amountCentavos={50000}
				settledCentavos={20000}
				suggestedAccountId={null}
				accounts={accounts}
				groups={[]}
				onSubmit={vi.fn()}
				onCancel={() => {}}
			/>,
		);
		const amountInput = document.querySelector("input[type='number']") as HTMLInputElement;
		// Clear first, then click Pay in full to verify it refills.
		fireEvent.change(amountInput, { target: { value: "0" } });
		expect(amountInput.value).toBe("0");
		fireEvent.click(screen.getByText("Pay in full"));
		expect(amountInput.value).toBe("300");
	});
});
