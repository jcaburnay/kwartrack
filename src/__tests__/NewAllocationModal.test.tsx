import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewAllocationModal } from "../components/budget/NewAllocationModal";
import type { Tag } from "../hooks/useTags";

const tags: Tag[] = [
	{ id: "t-foods", user_id: "u", name: "foods", type: "expense", is_system: false, created_at: "" } as unknown as Tag,
];

describe("NewAllocationModal", () => {
	it("rejects amount of 0 with a validation message", async () => {
		const onUpsert = vi.fn(async () => null);
		render(
			<NewAllocationModal
				candidateTags={tags}
				allocatedSumCentavos={0}
				overallCentavos={20_000_00}
				onUpsert={onUpsert}
				onSaved={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "0" } });
		fireEvent.click(screen.getByRole("button", { name: /^Add$/i }));
		expect(onUpsert).not.toHaveBeenCalled();
		expect(await screen.findByText(/Enter an amount greater than 0/i)).toBeInTheDocument();
	});

	it("rejects amounts that would push allocated total over overall", async () => {
		const onUpsert = vi.fn(async () => null);
		render(
			<NewAllocationModal
				candidateTags={tags}
				allocatedSumCentavos={15_000_00}
				overallCentavos={20_000_00}
				onUpsert={onUpsert}
				onSaved={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "6000" } });
		fireEvent.click(screen.getByRole("button", { name: /^Add$/i }));
		expect(onUpsert).not.toHaveBeenCalled();
		expect(
			await screen.findByText(/Tag allocations total .* but Overall is/i),
		).toBeInTheDocument();
	});

	it("calls onUpsert and onSaved on successful add", async () => {
		const onUpsert = vi.fn(async () => null);
		const onSaved = vi.fn();
		render(
			<NewAllocationModal
				candidateTags={tags}
				allocatedSumCentavos={0}
				overallCentavos={20_000_00}
				onUpsert={onUpsert}
				onSaved={onSaved}
				onCancel={vi.fn()}
			/>,
		);
		fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "1500" } });
		fireEvent.click(screen.getByRole("button", { name: /^Add$/i }));
		await screen.findByRole("dialog"); // settle async state
		expect(onUpsert).toHaveBeenCalledWith("t-foods", 1500_00);
		expect(onSaved).toHaveBeenCalled();
	});

	it("calls onCancel when backdrop is clicked", () => {
		const onCancel = vi.fn();
		render(
			<NewAllocationModal
				candidateTags={tags}
				allocatedSumCentavos={0}
				overallCentavos={20_000_00}
				onUpsert={vi.fn(async () => null)}
				onSaved={vi.fn()}
				onCancel={onCancel}
			/>,
		);
		fireEvent.click(screen.getByLabelText(/Dismiss modal/i));
		expect(onCancel).toHaveBeenCalled();
	});
});
