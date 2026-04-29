import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditAllocationModal } from "../components/budget/EditAllocationModal";
import type { BudgetAllocation } from "../hooks/useBudget";

const allocation = {
	tag_id: "t-foods",
	amount_centavos: 10_000_00,
	month: "2026-04",
	user_id: "u",
} as unknown as BudgetAllocation;

describe("EditAllocationModal", () => {
	it("pre-fills the input with the existing amount in pesos", () => {
		render(
			<EditAllocationModal
				allocation={allocation}
				tagName="foods"
				allocatedSumCentavos={10_000_00}
				overallCentavos={20_000_00}
				onUpsert={vi.fn(async () => null)}
				onDelete={vi.fn(async () => null)}
				onSaved={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		expect(screen.getByLabelText(/Amount/i)).toHaveValue(10000);
	});

	it("calls onUpsert with new amount on Save", async () => {
		const onUpsert = vi.fn(async () => null);
		const onSaved = vi.fn();
		render(
			<EditAllocationModal
				allocation={allocation}
				tagName="foods"
				allocatedSumCentavos={10_000_00}
				overallCentavos={20_000_00}
				onUpsert={onUpsert}
				onDelete={vi.fn(async () => null)}
				onSaved={onSaved}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "12000" } });
		fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
		await screen.findByRole("dialog");
		expect(onUpsert).toHaveBeenCalledWith("t-foods", 12000_00);
		expect(onSaved).toHaveBeenCalled();
	});

	it("calls onDelete when amount is set to 0 and Save is clicked", async () => {
		const onDelete = vi.fn(async () => null);
		const onSaved = vi.fn();
		render(
			<EditAllocationModal
				allocation={allocation}
				tagName="foods"
				allocatedSumCentavos={10_000_00}
				overallCentavos={20_000_00}
				onUpsert={vi.fn(async () => null)}
				onDelete={onDelete}
				onSaved={onSaved}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "0" } });
		fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
		await screen.findByRole("dialog");
		expect(onDelete).toHaveBeenCalledWith("t-foods");
		expect(onSaved).toHaveBeenCalled();
	});

	it("calls onDelete when explicit Delete button is clicked", async () => {
		const onDelete = vi.fn(async () => null);
		const onSaved = vi.fn();
		render(
			<EditAllocationModal
				allocation={allocation}
				tagName="foods"
				allocatedSumCentavos={10_000_00}
				overallCentavos={20_000_00}
				onUpsert={vi.fn(async () => null)}
				onDelete={onDelete}
				onSaved={onSaved}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
		await screen.findByRole("dialog");
		expect(onDelete).toHaveBeenCalledWith("t-foods");
		expect(onSaved).toHaveBeenCalled();
	});

	it("rejects new amounts that exceed overall when other allocations are factored in", async () => {
		const onUpsert = vi.fn(async () => null);
		render(
			<EditAllocationModal
				allocation={allocation}
				tagName="foods"
				allocatedSumCentavos={15_000_00} // foods 10k + others 5k
				overallCentavos={20_000_00}
				onUpsert={onUpsert}
				onDelete={vi.fn(async () => null)}
				onSaved={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		// foods → 16k; others 5k; total 21k > overall 20k → reject
		fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "16000" } });
		fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
		expect(onUpsert).not.toHaveBeenCalled();
		expect(
			await screen.findByText(/Tag allocations total .* but Overall is/i),
		).toBeInTheDocument();
	});
});
