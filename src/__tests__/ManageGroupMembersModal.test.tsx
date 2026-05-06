import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManageGroupMembersModal } from "../components/accounts/ManageGroupMembersModal";
import type { Account, AccountGroup } from "../utils/accountBalances";

type UpdatePayload = { group_id: string | null } | { name: string };
const updateInMock = vi.fn<(col: string, ids: string[]) => Promise<{ error: null }>>();
const updateEqMock = vi.fn<(col: string, value: string) => Promise<{ error: null }>>();
const updateMock = vi.fn<
	(payload: UpdatePayload) => { in: typeof updateInMock; eq: typeof updateEqMock }
>(() => ({
	in: updateInMock,
	eq: updateEqMock,
}));

vi.mock("../lib/supabase", () => ({
	supabase: {
		from: () => ({
			update: updateMock,
		}),
	},
}));

const groupA: AccountGroup = {
	id: "g-a",
	user_id: "u",
	name: "Maya",
	created_at: "",
	updated_at: "",
};
const groupB: AccountGroup = {
	id: "g-b",
	user_id: "u",
	name: "TonikBank",
	created_at: "",
	updated_at: "",
};

const accounts = [
	{ id: "a1", name: "Maya Savings", group_id: "g-a", is_archived: false },
	{ id: "a2", name: "Maya Wallet", group_id: "g-a", is_archived: false },
	{ id: "a3", name: "Tonik Savings", group_id: "g-b", is_archived: false },
	{ id: "a4", name: "BPI Savings", group_id: null, is_archived: false },
	{ id: "a5", name: "Archived Cash", group_id: null, is_archived: true },
] as unknown as Account[];

function renderModal(overrides: Partial<Parameters<typeof ManageGroupMembersModal>[0]> = {}) {
	const props = {
		group: groupA,
		accounts,
		groups: [groupA, groupB],
		onClose: vi.fn(),
		onChanged: vi.fn(),
		onRequestDelete: vi.fn(),
		...overrides,
	};
	render(<ManageGroupMembersModal {...props} />);
	return props;
}

describe("ManageGroupMembersModal", () => {
	beforeEach(() => {
		updateInMock.mockReset().mockResolvedValue({ error: null });
		updateEqMock.mockReset().mockResolvedValue({ error: null });
		updateMock.mockClear();
	});

	it("pre-checks current members, surfaces (in OtherGroup) for accounts already grouped, and hides archived", () => {
		renderModal();

		const mayaSavings = screen.getByLabelText(/Maya Savings/) as HTMLInputElement;
		const mayaWallet = screen.getByLabelText(/Maya Wallet/) as HTMLInputElement;
		const tonik = screen.getByLabelText(/Tonik Savings/) as HTMLInputElement;
		const bpi = screen.getByLabelText(/BPI Savings/) as HTMLInputElement;

		expect(mayaSavings.checked).toBe(true);
		expect(mayaWallet.checked).toBe(true);
		expect(tonik.checked).toBe(false);
		expect(bpi.checked).toBe(false);

		expect(screen.getByText("(in TonikBank)")).toBeInTheDocument();
		expect(screen.queryByText(/Archived Cash/)).not.toBeInTheDocument();
	});

	it("toggles selections and updates the Save-changes button label", () => {
		renderModal();

		const saveButton = screen.getByRole("button", { name: /^Save$/ });
		expect(saveButton).toBeDisabled();

		fireEvent.click(screen.getByLabelText(/BPI Savings/));
		expect(screen.getByRole("button", { name: /Save 1 change/ })).toBeEnabled();

		fireEvent.click(screen.getByLabelText(/Maya Wallet/));
		expect(screen.getByRole("button", { name: /Save 2 changes/ })).toBeEnabled();

		fireEvent.click(screen.getByLabelText(/BPI Savings/));
		fireEvent.click(screen.getByLabelText(/Maya Wallet/));
		expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();
	});

	it("blocks Delete with an in-modal error when the group has members, instead of calling onRequestDelete", () => {
		const onRequestDelete = vi.fn();
		renderModal({ onRequestDelete });

		fireEvent.click(screen.getByRole("button", { name: /Delete group/ }));

		expect(onRequestDelete).not.toHaveBeenCalled();
		expect(screen.getByText(/has 2 member accounts/)).toBeInTheDocument();
	});

	it("blocks Delete with a pending-changes error when toggles are unsaved", () => {
		const onRequestDelete = vi.fn();
		renderModal({ onRequestDelete });

		fireEvent.click(screen.getByLabelText(/BPI Savings/));
		fireEvent.click(screen.getByRole("button", { name: /Delete group/ }));

		expect(onRequestDelete).not.toHaveBeenCalled();
		expect(screen.getByText(/Save or cancel your pending changes/)).toBeInTheDocument();
	});

	it("calls onRequestDelete when the group is empty and there are no pending changes", () => {
		const emptyGroup: AccountGroup = {
			id: "g-empty",
			user_id: "u",
			name: "Empty",
			created_at: "",
			updated_at: "",
		};
		const onRequestDelete = vi.fn();
		renderModal({ group: emptyGroup, onRequestDelete });

		fireEvent.click(screen.getByRole("button", { name: /Delete group/ }));
		expect(onRequestDelete).toHaveBeenCalledWith(emptyGroup);
	});

	it("issues two update calls (added + removed) on save and closes the modal", async () => {
		const onChanged = vi.fn();
		const onClose = vi.fn();
		renderModal({ onChanged, onClose });

		fireEvent.click(screen.getByLabelText(/BPI Savings/)); // add
		fireEvent.click(screen.getByLabelText(/Maya Wallet/)); // remove

		fireEvent.click(screen.getByRole("button", { name: /Save 2 changes/ }));

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

		expect(updateMock).toHaveBeenCalledTimes(2);
		const payloads = updateMock.mock.calls.map(([arg]) => arg);
		expect(payloads).toContainEqual({ group_id: "g-a" });
		expect(payloads).toContainEqual({ group_id: null });

		const inArgs = updateInMock.mock.calls.map(([col, ids]) => ({ col, ids }));
		expect(inArgs).toContainEqual({ col: "id", ids: ["a4"] });
		expect(inArgs).toContainEqual({ col: "id", ids: ["a2"] });

		expect(onChanged).toHaveBeenCalledTimes(1);
	});
});
