import { describe, expect, it } from "vitest";
import { monthBounds } from "../utils/dateRange";

describe("monthBounds", () => {
	it("covers a normal month in Asia/Manila", () => {
		const today = new Date("2026-04-15T10:00:00Z");
		expect(monthBounds("Asia/Manila", today)).toEqual({
			startISO: "2026-04-01",
			endExclusiveISO: "2026-05-01",
			monthLabel: "April 2026",
		});
	});

	it("rolls over December to January", () => {
		const today = new Date("2026-12-15T10:00:00Z");
		expect(monthBounds("Asia/Manila", today)).toEqual({
			startISO: "2026-12-01",
			endExclusiveISO: "2027-01-01",
			monthLabel: "December 2026",
		});
	});

	it("respects the user's timezone when near midnight UTC", () => {
		// 2026-05-01 00:10 UTC is 2026-05-01 08:10 in Manila → May.
		const today = new Date("2026-05-01T00:10:00Z");
		expect(monthBounds("Asia/Manila", today).monthLabel).toBe("May 2026");
		// 2026-04-30 23:50 UTC is 2026-05-01 07:50 in Manila → May too.
		const close = new Date("2026-04-30T23:50:00Z");
		expect(monthBounds("Asia/Manila", close).monthLabel).toBe("May 2026");
		// In UTC the second date belongs to April.
		expect(monthBounds("UTC", close).monthLabel).toBe("April 2026");
	});
});
