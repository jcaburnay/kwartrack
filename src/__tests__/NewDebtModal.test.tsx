import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewDebtModal } from "../components/debts/NewDebtModal";
import type { Person } from "../hooks/usePersons";
import type { Tag } from "../hooks/useTags";
import type { Account } from "../utils/accountBalances";

const persons: Person[] = [{ id: "p1", user_id: "u", name: "Alice", created_at: "" }];
const accounts = [
	{ id: "a1", name: "Cash", type: "cash", is_archived: false },
] as unknown as Account[];
const tags = [
	{
		id: "t1",
		user_id: "u",
		name: "foods",
		type: "expense",
		is_system: false,
		created_at: "",
	},
] as unknown as Tag[];

describe("NewDebtModal", () => {
	it("submits a data-only loaned debt (no account, no tag)", async () => {
		const create = vi.fn().mockResolvedValue({ error: null });
		render(
			<NewDebtModal
				persons={persons}
				accounts={accounts}
				tags={tags}
				createPerson={async () => null}
				createDebt={create}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		// Pick Alice via the picker (placeholder is unique to PersonPicker; <select>s also have role=combobox).
		fireEvent.change(screen.getByPlaceholderText("Search or add…"), {
			target: { value: "ali" },
		});
		fireEvent.click(screen.getByText("Alice"));
		const amountInput = document.querySelector(
			"input[type='number']",
		) as HTMLInputElement;
		fireEvent.change(amountInput, { target: { value: "100" } });
		fireEvent.click(screen.getByRole("button", { name: /Create Debt/i }));
		await waitFor(() => expect(create).toHaveBeenCalled());
		const input = create.mock.calls[0][0];
		expect(input.personId).toBe("p1");
		expect(input.direction).toBe("loaned");
		expect(input.amountCentavos).toBe(10000);
		expect(input.paidAccountId).toBeNull();
	});
});
