import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewSplitModal } from "../components/debts/NewSplitModal";
import type { Person } from "../hooks/usePersons";
import type { Tag } from "../hooks/useTags";
import type { Account } from "../utils/accountBalances";

const persons: Person[] = [
	{ id: "p1", user_id: "u", name: "Alice", created_at: "" },
	{ id: "p2", user_id: "u", name: "Bob", created_at: "" },
];
const accounts = [
	{ id: "a1", name: "Maya", type: "e-wallet", is_archived: false },
] as unknown as Account[];
const tags = [
	{
		id: "t1",
		user_id: "u",
		name: "dates",
		type: "expense",
		is_system: false,
		created_at: "",
	},
] as unknown as Tag[];

describe("NewSplitModal", () => {
	it("creates an equal 3-way split (user + Alice + Bob), payer absorbs remainder", async () => {
		const create = vi.fn().mockResolvedValue({ error: null });
		render(
			<NewSplitModal
				persons={persons}
				accounts={accounts}
				tags={tags}
				createPerson={async () => null}
				createSplit={create}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		const inputs = document.querySelectorAll("input[type='text'], input[type='number']");
		// inputs[0] = description (text), inputs[1] = total (number)
		fireEvent.change(inputs[0], { target: { value: "lunch" } });
		fireEvent.change(inputs[1], { target: { value: "100" } });

		const selects = document.querySelectorAll("select");
		// selects[0] = paid-from, selects[1] = tag
		fireEvent.change(selects[0], { target: { value: "a1" } });
		fireEvent.change(selects[1], { target: { value: "t1" } });

		// Add Alice and Bob via the participant picker (only PersonPicker has this placeholder).
		fireEvent.change(screen.getByPlaceholderText("Search or add…"), {
			target: { value: "Alice" },
		});
		fireEvent.click(screen.getByText("Alice"));
		fireEvent.change(screen.getByPlaceholderText("Search or add…"), {
			target: { value: "Bob" },
		});
		fireEvent.click(screen.getByText("Bob"));

		fireEvent.click(screen.getByRole("button", { name: /Create Split/i }));
		await waitFor(() => expect(create).toHaveBeenCalled());
		const arg = create.mock.calls[0][0];
		expect(arg.totalCentavos).toBe(10000);
		// Two participants in input; user is implicit payer.
		expect(arg.participants.length).toBe(2);
		// Equal: 100 / 3 = 33.33 with 1 cent remainder absorbed by payer.
		expect(arg.participants[0].shareCentavos).toBe(3333);
		expect(arg.participants[1].shareCentavos).toBe(3333);
	});
});
