import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../components/Input";

describe("Input", () => {
	it("renders label text", () => {
		render(<Input label="Account name" id="account-name" />);
		expect(screen.getByText("Account name")).toBeInTheDocument();
	});

	it("associates label with input via htmlFor", () => {
		render(<Input label="Account name" id="account-name" />);
		const label = screen.getByText("Account name").closest("label");
		expect(label).toHaveAttribute("for", "account-name");
	});

	it("renders with base input classes", () => {
		render(<Input label="Test" id="test" />);
		const input = screen.getByRole("textbox");
		expect(input).toHaveClass("input", "input-bordered", "w-full");
	});

	it("adds input-error class when error is provided", () => {
		render(<Input label="Test" id="test" error="Required" />);
		const input = screen.getByRole("textbox");
		expect(input).toHaveClass("input-error");
	});

	it("renders error message when error is provided", () => {
		render(<Input label="Test" id="test" error="This field is required" />);
		expect(screen.getByText("This field is required")).toBeInTheDocument();
	});

	it("does not render error paragraph when no error", () => {
		const { container } = render(<Input label="Test" id="test" />);
		expect(container.querySelector(".text-error")).toBeNull();
	});

	it("renders hint when provided", () => {
		render(<Input label="Balance" id="balance" hint={<span data-testid="hint">Hint text</span>} />);
		expect(screen.getByTestId("hint")).toBeInTheDocument();
	});

	it("does not render hint area when hint is undefined", () => {
		const { container } = render(<Input label="Test" id="test" />);
		expect(container.querySelector("[data-testid='hint']")).toBeNull();
	});

	it("accepts ReactNode label for rich content", () => {
		render(
			<Input
				label={
					<>
						Description <span data-testid="optional">(optional)</span>
					</>
				}
				id="desc"
			/>,
		);
		expect(screen.getByTestId("optional")).toBeInTheDocument();
	});

	it("passes through standard input props", () => {
		render(<Input label="Test" id="test" type="number" placeholder="0.00" />);
		const input = screen.getByPlaceholderText("0.00");
		expect(input).toHaveAttribute("type", "number");
	});
});
