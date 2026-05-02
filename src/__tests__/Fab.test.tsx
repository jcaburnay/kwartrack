import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Fab } from "../components/Fab";

describe("Fab", () => {
	const onClick = vi.fn();

	beforeEach(() => {
		onClick.mockReset();
	});

	const actions = [
		{
			label: "New Account",
			description: "Create account.",
			icon: <span aria-hidden="true">·</span>,
			onClick,
		},
	];

	it("renders the trigger and all actions", () => {
		render(<Fab actions={actions} />);
		expect(screen.getByRole("button", { name: /open action menu/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /new account/i })).toBeInTheDocument();
	});

	it("fires the action's onClick when its button is clicked", async () => {
		render(<Fab actions={actions} />);
		await userEvent.click(screen.getByRole("button", { name: /new account/i }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
