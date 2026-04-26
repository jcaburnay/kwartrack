import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebtsTable } from "../components/debts/DebtsTable";
import type { DebtRow } from "../utils/debtFilters";

const debts: DebtRow[] = [
	{
		id: "d1",
		personId: "p1",
		personName: "Alice",
		direction: "loaned",
		amountCentavos: 50000,
		settledCentavos: 0,
		tagId: "t1",
		tagName: "foods",
		date: "2026-04-14",
		description: "lunch",
	},
	{
		id: "d2",
		personId: "p1",
		personName: "Alice",
		direction: "loaned",
		amountCentavos: 400000,
		settledCentavos: 400000,
		tagId: "t1",
		tagName: "foods",
		date: "2026-04-18",
		description: "Bali",
	},
];

describe("DebtsTable", () => {
	it("groups rows by person and shows the per-person net total", () => {
		render(
			<DebtsTable
				debts={debts}
				tagsById={new Map([["t1", "foods"]])}
				onSettle={() => {}}
				onDelete={() => {}}
			/>,
		);
		expect(screen.getByText(/Alice/)).toBeInTheDocument();
		// Net owed: 50000 - 0 = 50000, plus 400000 - 400000 = 0 -> 500.00 net owed.
		expect(screen.getByText(/net owed to you/i)).toBeInTheDocument();
	});
});
