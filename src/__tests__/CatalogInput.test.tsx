import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogInput } from "../components/CatalogInput";

describe("CatalogInput", () => {
	it("renders label text", () => {
		render(<CatalogInput label="Name" id="name" filterValue="" onSelect={vi.fn()} />);
		expect(screen.getByText("Name")).toBeInTheDocument();
	});

	it("renders error message when error prop provided", () => {
		render(
			<CatalogInput
				label="Name"
				id="name"
				filterValue=""
				error="Name is required"
				onSelect={vi.fn()}
			/>,
		);
		expect(screen.getByText("Name is required")).toBeInTheDocument();
	});

	it("shows suggestions when filterValue matches catalog entries", async () => {
		render(<CatalogInput label="Name" id="name" filterValue="Netflix" onSelect={vi.fn()} />);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "Netflix" } });
		await waitFor(() => {
			expect(screen.getByRole("list")).toBeInTheDocument();
		});
	});

	it("calls onSelect with entry name on mousedown", async () => {
		const onSelect = vi.fn();
		render(<CatalogInput label="Name" id="name" filterValue="Netflix" onSelect={onSelect} />);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "Netflix" } });
		await waitFor(() => screen.getByRole("list"));
		const firstButton = screen.getAllByRole("button")[0];
		fireEvent.mouseDown(firstButton);
		expect(onSelect).toHaveBeenCalledOnce();
		expect(onSelect).toHaveBeenCalledWith("Netflix");
	});

	it("does not show suggestions when suggestionsEnabled is false", () => {
		render(
			<CatalogInput
				label="Name"
				id="name"
				filterValue="Netflix"
				onSelect={vi.fn()}
				suggestionsEnabled={false}
			/>,
		);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "Netflix" } });
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("navigates suggestions with ArrowDown and selects with Enter", async () => {
		const onSelect = vi.fn();
		render(<CatalogInput label="Name" id="name" filterValue="Netflix" onSelect={onSelect} />);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "Netflix" } });
		await waitFor(() => screen.getByRole("list"));
		fireEvent.keyDown(input, { key: "ArrowDown" });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledOnce();
	});

	it("closes suggestions on Escape", async () => {
		render(<CatalogInput label="Name" id="name" filterValue="Netflix" onSelect={vi.fn()} />);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "Netflix" } });
		await waitFor(() => screen.getByRole("list"));
		fireEvent.keyDown(input, { key: "Escape" });
		await waitFor(() => {
			expect(screen.queryByRole("list")).toBeNull();
		});
	});
});
