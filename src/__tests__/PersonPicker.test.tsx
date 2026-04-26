import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonPicker } from "../components/debts/PersonPicker";

const persons = [
	{ id: "1", user_id: "u", name: "Alice", created_at: "" },
	{ id: "2", user_id: "u", name: "Bob", created_at: "" },
	{ id: "3", user_id: "u", name: "Carol", created_at: "" },
];

describe("PersonPicker", () => {
	it("filters persons as the user types", () => {
		render(
			<PersonPicker
				persons={persons}
				value={null}
				onChange={() => {}}
				onCreate={async () => null}
			/>,
		);
		const input = screen.getByRole("combobox");
		fireEvent.change(input, { target: { value: "ali" } });
		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.queryByText("Bob")).not.toBeInTheDocument();
	});

	it("offers an inline-create row when no match exists", () => {
		render(
			<PersonPicker
				persons={persons}
				value={null}
				onChange={() => {}}
				onCreate={async () => null}
			/>,
		);
		const input = screen.getByRole("combobox");
		fireEvent.change(input, { target: { value: "Doris" } });
		expect(screen.getByText(/\+ New person "Doris"/)).toBeInTheDocument();
	});

	it("invokes onChange when a person is selected", () => {
		const onChange = vi.fn();
		render(
			<PersonPicker
				persons={persons}
				value={null}
				onChange={onChange}
				onCreate={async () => null}
			/>,
		);
		fireEvent.change(screen.getByRole("combobox"), { target: { value: "ali" } });
		fireEvent.click(screen.getByText("Alice"));
		expect(onChange).toHaveBeenCalledWith("1");
	});
});
