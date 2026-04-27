import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SplitRowExpansion } from "../components/debts/SplitRowExpansion";
import type { SplitRow } from "../utils/splitFilters";

const split: SplitRow = {
	id: "s1",
	description: "lunch",
	totalCentavos: 30000,
	userShareCentavos: 10000,
	paidFromAccountId: "a1",
	tagId: "t1",
	tagName: "dates",
	method: "equal",
	date: "2026-04-26",
	participantCount: 3,
	settledCount: 1,
	participantNames: ["Alice", "Bob"],
};

describe("SplitRowExpansion", () => {
	it("renders participant rows + summary footer", async () => {
		render(
			<MemoryRouter>
				<SplitRowExpansion
					split={split}
					loadParticipants={async () => [
						{
							participantId: "p1",
							debtId: "d1",
							personId: "p1",
							personName: "Alice",
							shareCentavos: 10000,
							settledCentavos: 10000,
						},
						{
							participantId: "p2",
							debtId: "d2",
							personId: "p2",
							personName: "Bob",
							shareCentavos: 10000,
							settledCentavos: 0,
						},
					]}
					onSettleParticipant={() => {}}
					onEdit={() => {}}
					onDelete={() => {}}
				/>
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
		expect(screen.getByText("Bob")).toBeInTheDocument();
		expect(screen.getByText(/3-way · equal/)).toBeInTheDocument();
	});
});
