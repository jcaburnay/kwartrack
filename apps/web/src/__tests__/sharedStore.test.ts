import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createKeyedSharedStore, createSharedStore } from "../hooks/sharedStore";
import { bumpVersion } from "../hooks/useTransactionVersion";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}
describe("shared budget stores", () => {
	it("refreshes a cached period when returning after edits made elsewhere", async () => {
		const values: Record<string, string> = { A: "A-before", B: "B-before" };
		const store = createKeyedSharedStore<string, string>(async (key) => values[key], "", [
			"transaction",
		]);
		const hook = renderHook(({ id }) => store.useStore(id), { initialProps: { id: "A" } });
		await waitFor(() => expect(hook.result.current.data).toBe("A-before"));
		hook.rerender({ id: "B" });
		await waitFor(() => expect(hook.result.current.data).toBe("B-before"));
		values.A = "A-after";
		values.B = "B-after";
		act(() => bumpVersion("transaction"));
		await waitFor(() => expect(hook.result.current.data).toBe("B-after"));
		hook.rerender({ id: "A" });
		await waitFor(() => expect(hook.result.current.data).toBe("A-after"));
	});

	it("discards a previous user's in-flight result after reset", async () => {
		const old = deferred<string>();
		const next = deferred<string>();
		let calls = 0;
		const store = createSharedStore(() => (++calls === 1 ? old.promise : next.promise), "", []);
		const hook = renderHook(() => store.useStore());
		act(() => store.reset());
		const refresh = store.refetch();
		await act(async () => {
			old.resolve("previous-user-budget");
			await Promise.resolve();
		});
		expect(hook.result.current.data).not.toBe("previous-user-budget");
		await act(async () => {
			next.resolve("current-user-budget");
			await refresh;
		});
		await waitFor(() => expect(hook.result.current.data).toBe("current-user-budget"));
	});
	it("refetches when budget invalidation arrives during an in-flight query", async () => {
		const old = deferred<string>();
		let calls = 0;
		const store = createSharedStore(async () => (++calls === 1 ? old.promise : "new-budget"), "", [
			"budget_period",
		]);
		const hook = renderHook(() => store.useStore());
		act(() => bumpVersion("budget_period"));
		await act(async () => {
			old.resolve("stale-budget");
			await Promise.resolve();
		});
		await waitFor(() => expect(hook.result.current.data).toBe("new-budget"));
	});
});
