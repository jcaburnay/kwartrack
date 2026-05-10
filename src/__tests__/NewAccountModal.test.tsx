import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewAccountModal } from "../components/accounts/NewAccountModal";

const insert = vi.fn();

vi.mock("../lib/supabase", () => ({
	supabase: {
		from: () => ({
			insert: (...args: unknown[]) => {
				insert(...args);
				return Promise.resolve({ error: null });
			},
			select: () => ({
				single: () => Promise.resolve({ data: { id: "g-new" }, error: null }),
			}),
		}),
	},
}));

vi.mock("../providers/AuthProvider", () => ({
	useAuth: () => ({ user: { id: "u1" } }),
}));

describe("NewAccountModal — type picker", () => {
	beforeEach(() => {
		insert.mockReset();
	});

	it("shows all five account types as options", () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		expect(screen.getByRole("button", { name: /^cash/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /e-wallet/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^savings/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^credit card/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /time deposit/i })).toBeInTheDocument();
	});

	it("reveals the cash form after picking Cash", async () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /^cash/i }));
		expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/initial balance/i)).toBeInTheDocument();
	});

	it("reveals credit-specific fields after picking Credit card", async () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /^credit card/i }));
		expect(screen.getByLabelText(/credit limit/i)).toBeInTheDocument();
	});

	it("reveals time-deposit fields after picking Time deposit", async () => {
		render(
			<NewAccountModal
				groups={[]}
				onRefetchGroups={async () => {}}
				onSaved={() => {}}
				onCancel={() => {}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /time deposit/i }));
		expect(screen.getByLabelText(/principal/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/maturity date/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/interest posts/i)).toBeInTheDocument();
	});
});
