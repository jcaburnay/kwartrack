import { describe, expect, it } from "vitest";
import {
	type ActualRow,
	computeActualsByTag,
	computeOthersCentavos,
	computeOverallActualCentavos,
	progressBucket,
} from "../utils/budgetMath";

describe("computeActualsByTag", () => {
	it("sums effective centavos by tag for the given month", () => {
		const rows: ActualRow[] = [
			{ tagId: "foods", effectiveCentavos: 100_00, date: "2026-04-02" },
			{ tagId: "foods", effectiveCentavos: 50_00, date: "2026-04-15" },
			{ tagId: "pets", effectiveCentavos: 200_00, date: "2026-04-20" },
		];
		const actuals = computeActualsByTag(rows, "2026-04");
		expect(actuals.get("foods")).toBe(150_00);
		expect(actuals.get("pets")).toBe(200_00);
	});

	it("uses the user-share for split-linked rows (caller passes user_share_centavos)", () => {
		// Auto-expense from a ₱4,800 split where the user's share is ₱960.
		const rows: ActualRow[] = [{ tagId: "dates", effectiveCentavos: 960_00, date: "2026-04-14" }];
		expect(computeActualsByTag(rows, "2026-04").get("dates")).toBe(960_00);
	});

	it("excludes rows outside the given month", () => {
		const rows: ActualRow[] = [
			{ tagId: "foods", effectiveCentavos: 100_00, date: "2026-03-31" },
			{ tagId: "foods", effectiveCentavos: 50_00, date: "2026-05-01" },
		];
		expect(computeActualsByTag(rows, "2026-04").size).toBe(0);
	});

	it("skips rows with null tag_id", () => {
		const rows: ActualRow[] = [{ tagId: null, effectiveCentavos: 100_00, date: "2026-04-02" }];
		expect(computeActualsByTag(rows, "2026-04").size).toBe(0);
	});
});

describe("computeOthersCentavos", () => {
	it("sums only entries whose tag is NOT in the allocated set", () => {
		const actuals = new Map([
			["foods", 100_00],
			["pets", 200_00],
			["unbudgeted-tag", 50_00],
		]);
		const allocated = new Set(["foods", "pets"]);
		expect(computeOthersCentavos(actuals, allocated)).toBe(50_00);
	});

	it("returns 0 when every actual tag is allocated", () => {
		const actuals = new Map([["foods", 100_00]]);
		expect(computeOthersCentavos(actuals, new Set(["foods"]))).toBe(0);
	});

	it("returns the full sum when nothing is allocated", () => {
		const actuals = new Map([
			["foods", 100_00],
			["pets", 50_00],
		]);
		expect(computeOthersCentavos(actuals, new Set())).toBe(150_00);
	});
});

describe("computeOverallActualCentavos", () => {
	it("sums every actual entry, allocated or not", () => {
		const actuals = new Map([
			["foods", 100_00],
			["pets", 200_00],
			["others", 50_00],
		]);
		expect(computeOverallActualCentavos(actuals)).toBe(350_00);
	});

	it("returns 0 for an empty map", () => {
		expect(computeOverallActualCentavos(new Map())).toBe(0);
	});
});

describe("progressBucket", () => {
	it("returns 'empty' when budget is 0 or negative", () => {
		expect(progressBucket(0, 0)).toBe("empty");
		expect(progressBucket(100, 0)).toBe("empty");
		expect(progressBucket(0, -1)).toBe("empty");
	});

	it("returns 'green' when actual < 80% of budget", () => {
		expect(progressBucket(0, 100)).toBe("green");
		expect(progressBucket(50, 100)).toBe("green");
		expect(progressBucket(7999, 10000)).toBe("green"); // 79.99%
	});

	it("returns 'orange' from 80% up to and including 100%", () => {
		expect(progressBucket(80, 100)).toBe("orange");
		expect(progressBucket(95, 100)).toBe("orange");
		expect(progressBucket(100, 100)).toBe("orange");
	});

	it("returns 'red' above 100%", () => {
		expect(progressBucket(101, 100)).toBe("red");
		expect(progressBucket(500, 100)).toBe("red");
	});
});

import { projectedBucket } from "../utils/budgetMath";

describe("projectedBucket", () => {
	const TZ = "Asia/Manila";
	const earlyDay = new Date("2026-04-02T01:00:00Z"); // day 2
	const midDay = new Date("2026-04-15T01:00:00Z"); // day 15 of 30

	it("returns 'empty' when allocated is 0", () => {
		expect(projectedBucket(0, 0, midDay, TZ, "2026-04")).toBe("empty");
	});

	it("returns 'red' when actual already exceeds allocated", () => {
		expect(projectedBucket(11_000_00, 10_000_00, midDay, TZ, "2026-04")).toBe("red");
	});

	it("falls back to threshold-based bucket on early-month days", () => {
		// 79% on day 2 → green via threshold
		expect(projectedBucket(7_900_00, 10_000_00, earlyDay, TZ, "2026-04")).toBe("green");
		// 80% on day 2 → orange via threshold
		expect(projectedBucket(8_000_00, 10_000_00, earlyDay, TZ, "2026-04")).toBe("orange");
	});

	it("returns 'orange' when projected end-of-month exceeds allocated but actual hasn't yet", () => {
		// Day 15 of 30, actual 6000 → projected 12000 > 10000 → orange
		expect(projectedBucket(6_000_00, 10_000_00, midDay, TZ, "2026-04")).toBe("orange");
	});

	it("returns 'green' when on or below pace", () => {
		// Day 15 of 30, actual 5000 → projected 10000 == 10000 → green
		expect(projectedBucket(5_000_00, 10_000_00, midDay, TZ, "2026-04")).toBe("green");
		expect(projectedBucket(2_000_00, 10_000_00, midDay, TZ, "2026-04")).toBe("green");
	});

	it("respects past months: actual ≤ allocated stays green even without pacing data", () => {
		// Past month, day-of-month doesn't matter; under allocated → green
		expect(projectedBucket(4_000_00, 10_000_00, midDay, TZ, "2026-03")).toBe("green");
	});
});
