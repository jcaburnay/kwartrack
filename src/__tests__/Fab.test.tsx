import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Fab } from "../components/Fab";

describe("Fab", () => {
	const onClick = vi.fn();
	const onToggle = vi.fn();
	const onDismiss = vi.fn();

	beforeEach(() => {
		onClick.mockReset();
		onToggle.mockReset();
		onDismiss.mockReset();
	});

	const actions = [{ label: "New Account", description: "Create account.", onClick }];

	it("hides actions when closed", () => {
		render(<Fab actions={actions} isOpen={false} onToggle={onToggle} onDismiss={onDismiss} />);
		expect(screen.queryByRole("button", { name: /new account/i })).not.toBeInTheDocument();
	});

	it("shows actions and fires click + dismiss", async () => {
		render(<Fab actions={actions} isOpen={true} onToggle={onToggle} onDismiss={onDismiss} />);
		await userEvent.click(screen.getByRole("button", { name: /new account/i }));
		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("toggles on trigger click", async () => {
		render(<Fab actions={actions} isOpen={false} onToggle={onToggle} onDismiss={onDismiss} />);
		await userEvent.click(screen.getByRole("button", { name: /open action menu/i }));
		expect(onToggle).toHaveBeenCalledTimes(1);
	});
});
