import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../providers/AuthProvider";

type AuthChangeCallback = (event: string, session: unknown) => void;

const getSession = vi.fn();
const signOut = vi.fn();
let capturedCallback: AuthChangeCallback | null = null;
const unsubscribe = vi.fn();

const maybeSingle = vi.fn();
const from = vi.fn((_table: string) => ({
	select: () => ({
		eq: () => ({
			maybeSingle,
		}),
	}),
}));

vi.mock("../lib/supabase", () => ({
	supabase: {
		auth: {
			getSession: () => getSession(),
			signOut: () => signOut(),
			onAuthStateChange: (cb: AuthChangeCallback) => {
				capturedCallback = cb;
				return { data: { subscription: { unsubscribe } } };
			},
		},
		from: (table: string) => from(table),
	},
}));

function Probe() {
	const { session, profile, isLoading, signOut: doSignOut } = useAuth();
	return (
		<div>
			<span data-testid="loading">{String(isLoading)}</span>
			<span data-testid="session">{session ? "yes" : "no"}</span>
			<span data-testid="profile">{profile?.display_name ?? "none"}</span>
			<button type="button" onClick={() => doSignOut()}>
				Sign out
			</button>
		</div>
	);
}

function renderProbe() {
	return render(
		<AuthProvider>
			<Probe />
		</AuthProvider>,
	);
}

describe("AuthProvider", () => {
	beforeEach(() => {
		getSession.mockReset();
		signOut.mockReset();
		unsubscribe.mockReset();
		maybeSingle.mockReset();
		from.mockClear();
		capturedCallback = null;
	});

	it("starts loading, resolves to signed-out when getSession returns null", async () => {
		getSession.mockResolvedValueOnce({ data: { session: null } });
		renderProbe();
		expect(screen.getByTestId("loading").textContent).toBe("true");
		await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
		expect(screen.getByTestId("session").textContent).toBe("no");
		expect(screen.getByTestId("profile").textContent).toBe("none");
	});

	it("loads the user_profile when a session exists", async () => {
		getSession.mockResolvedValueOnce({
			data: { session: { user: { id: "u1" } } },
		});
		maybeSingle.mockResolvedValueOnce({
			data: { display_name: "Jane", id: "u1" },
			error: null,
		});
		renderProbe();
		await waitFor(() => expect(screen.getByTestId("session").textContent).toBe("yes"));
		await waitFor(() => expect(screen.getByTestId("profile").textContent).toBe("Jane"));
	});

	it("reacts to onAuthStateChange and delegates signOut to supabase", async () => {
		getSession.mockResolvedValueOnce({ data: { session: null } });
		maybeSingle.mockResolvedValueOnce({
			data: { display_name: "Jane", id: "u1" },
			error: null,
		});
		renderProbe();
		await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

		act(() => {
			capturedCallback?.("SIGNED_IN", { user: { id: "u1" } });
		});
		await waitFor(() => expect(screen.getByTestId("session").textContent).toBe("yes"));

		signOut.mockResolvedValueOnce(undefined);
		await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalledTimes(1);

		act(() => {
			capturedCallback?.("SIGNED_OUT", null);
		});
		await waitFor(() => expect(screen.getByTestId("session").textContent).toBe("no"));
		expect(screen.getByTestId("profile").textContent).toBe("none");
	});
});
