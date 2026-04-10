import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BankInput } from "../components/BankInput";

describe("BankInput", () => {
	it("renders label text", () => {
		render(<BankInput label="Account name" id="name" onSelectBank={vi.fn()} />);
		expect(screen.getByText("Account name")).toBeInTheDocument();
	});

	it("renders input with bordered classes", () => {
		render(<BankInput label="Account name" id="name" onSelectBank={vi.fn()} />);
		const input = screen.getByRole("textbox");
		expect(input).toHaveClass("input", "input-bordered", "w-full");
	});

	it("adds input-error class when error prop provided", () => {
		render(<BankInput label="Account name" id="name" error="Required" onSelectBank={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveClass("input-error");
	});

	it("renders error message when error prop provided", () => {
		render(
			<BankInput
				label="Account name"
				id="name"
				error="Account name is required"
				onSelectBank={vi.fn()}
			/>,
		);
		expect(screen.getByText("Account name is required")).toBeInTheDocument();
	});

	it("shows suggestions after typing a known bank name", async () => {
		render(<BankInput label="Account name" id="name" onSelectBank={vi.fn()} />);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "BDO" } });
		await waitFor(() => {
			expect(screen.getByRole("list")).toBeInTheDocument();
		});
	});

	it("calls onSelectBank with the bank when a suggestion is clicked", async () => {
		const onSelectBank = vi.fn();
		render(<BankInput label="Account name" id="name" onSelectBank={onSelectBank} />);
		const input = screen.getByRole("textbox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "BDO" } });
		await waitFor(() => screen.getByRole("list"));
		const firstButton = screen.getAllByRole("button")[0];
		fireEvent.mouseDown(firstButton);
		expect(onSelectBank).toHaveBeenCalledOnce();
		expect(onSelectBank.mock.calls[0][0]).toHaveProperty("id");
		expect(onSelectBank.mock.calls[0][0]).toHaveProperty("name");
	});

	it("passes through onChange to caller", () => {
		const onChange = vi.fn();
		render(<BankInput label="Account name" id="name" onSelectBank={vi.fn()} onChange={onChange} />);
		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "test" },
		});
		expect(onChange).toHaveBeenCalledOnce();
	});
});
