import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField, inputCls } from "../components/FormField";

describe("FormField", () => {
	it("renders label text", () => {
		render(
			<FormField label="Account name" id="account-name">
				<input id="account-name" />
			</FormField>,
		);
		expect(screen.getByText("Account name")).toBeInTheDocument();
	});

	it("associates label with input via htmlFor", () => {
		render(
			<FormField label="Account name" id="account-name">
				<input id="account-name" />
			</FormField>,
		);
		const label = screen.getByText("Account name").closest("label");
		expect(label).toHaveAttribute("for", "account-name");
	});

	it("renders children", () => {
		render(
			<FormField label="Test" id="test-input">
				<input id="test-input" placeholder="Enter value" />
			</FormField>,
		);
		expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
	});

	it("renders error message when error prop provided", () => {
		render(
			<FormField label="Test" id="test-input" error="This field is required">
				<input id="test-input" />
			</FormField>,
		);
		expect(screen.getByText("This field is required")).toBeInTheDocument();
	});

	it("does not render error paragraph when error is undefined", () => {
		const { container } = render(
			<FormField label="Test" id="test-input">
				<input id="test-input" />
			</FormField>,
		);
		expect(container.querySelector(".text-error")).toBeNull();
	});
});

describe("inputCls", () => {
	it("returns base input classes with no error", () => {
		expect(inputCls()).toBe("input input-bordered w-full");
	});

	it("appends input-error when error string is provided", () => {
		expect(inputCls("Required")).toBe("input input-bordered w-full input-error");
	});

	it("appends input-error for any truthy string", () => {
		expect(inputCls("x")).toBe("input input-bordered w-full input-error");
	});
});
