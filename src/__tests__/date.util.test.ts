import { describe, expect, it } from "vitest";
import type { Timestamp } from "spacetimedb";
import { fromTimestamp, todayISO, toISODate } from "../utils/date";

function makeTimestamp(d: Date): Timestamp {
	return { microsSinceUnixEpoch: BigInt(d.getTime()) * 1000n } as unknown as Timestamp;
}

describe("fromTimestamp", () => {
	it("converts a Timestamp to the equivalent Date", () => {
		const d = new Date("2026-04-17T10:30:00.000Z");
		const ts = makeTimestamp(d);
		expect(fromTimestamp(ts).getTime()).toBe(d.getTime());
	});
	it("handles the unix epoch", () => {
		const ts = makeTimestamp(new Date(0));
		expect(fromTimestamp(ts).getTime()).toBe(0);
	});
});

describe("toISODate (UTC)", () => {
	it("formats a Date as YYYY-MM-DD using UTC", () => {
		const d = new Date("2026-04-17T10:30:00.000Z");
		expect(toISODate(d)).toBe("2026-04-17");
	});
	it("matches the inline .toISOString().slice(0,10) pattern", () => {
		const d = new Date("2026-12-31T23:59:59.999Z");
		expect(toISODate(d)).toBe(d.toISOString().slice(0, 10));
	});
});

describe("todayISO (local timezone)", () => {
	it("returns today's date in YYYY-MM-DD format", () => {
		const result = todayISO();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
	it("matches the local-calendar date, not UTC", () => {
		// Build the expected local-calendar string manually — the getFullYear /
		// getMonth / getDate path that TransactionModal's original inline helper used.
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		expect(todayISO()).toBe(`${y}-${m}-${day}`);
	});
});
