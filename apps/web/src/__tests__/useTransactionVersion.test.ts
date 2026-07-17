import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bumpTransactionVersion, useTransactionVersion } from "../hooks/useTransactionVersion";

describe("useTransactionVersion", () => {
	it("returns the current version on mount", () => {
		const { result } = renderHook(() => useTransactionVersion());
		expect(typeof result.current).toBe("number");
	});

	it("re-renders subscribed components on bump", () => {
		const { result } = renderHook(() => useTransactionVersion());
		const before = result.current;
		act(() => {
			bumpTransactionVersion();
		});
		expect(result.current).toBe(before + 1);
	});

	it("notifies multiple subscribers on a single bump", () => {
		const a = renderHook(() => useTransactionVersion());
		const b = renderHook(() => useTransactionVersion());
		const startA = a.result.current;
		const startB = b.result.current;
		act(() => {
			bumpTransactionVersion();
		});
		expect(a.result.current).toBe(startA + 1);
		expect(b.result.current).toBe(startB + 1);
	});

	it("stops notifying after unmount", () => {
		const { result, unmount } = renderHook(() => useTransactionVersion());
		const before = result.current;
		unmount();
		act(() => {
			bumpTransactionVersion();
		});
		expect(result.current).toBe(before);
	});
});
