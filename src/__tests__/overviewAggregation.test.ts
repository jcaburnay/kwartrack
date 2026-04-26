import { describe, expect, it } from "vitest";
import { bucketSpendByMonth, type SpendInputRow } from "../utils/overviewAggregation";

const TZ = "Asia/Manila";

describe("bucketSpendByMonth", () => {
	it("returns exactly 12 month buckets oldest → newest anchored on today's month", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const result = bucketSpendByMonth([], today, TZ);
		expect(result).toHaveLength(12);
		expect(result[0].monthISO).toBe("2025-05");
		expect(result[11].monthISO).toBe("2026-04");
		expect(result.every((r) => r.totalCentavos === 0)).toBe(true);
	});

	it("sums effectiveCentavos into the matching month bucket", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const rows: SpendInputRow[] = [
			{ date: "2026-04-01", effectiveCentavos: 100_00 },
			{ date: "2026-04-30", effectiveCentavos: 50_00 },
			{ date: "2026-03-01", effectiveCentavos: 25_00 },
			{ date: "2025-05-15", effectiveCentavos: 7_00 },
		];
		const result = bucketSpendByMonth(rows, today, TZ);
		const apr = result.find((r) => r.monthISO === "2026-04");
		const mar = result.find((r) => r.monthISO === "2026-03");
		const may25 = result.find((r) => r.monthISO === "2025-05");
		expect(apr?.totalCentavos).toBe(150_00);
		expect(mar?.totalCentavos).toBe(25_00);
		expect(may25?.totalCentavos).toBe(7_00);
	});

	it("ignores rows outside the 12-month window", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const rows: SpendInputRow[] = [
			{ date: "2025-04-30", effectiveCentavos: 9999_00 }, // 1 day before window starts
			{ date: "2026-04-15", effectiveCentavos: 1_00 },
		];
		const result = bucketSpendByMonth(rows, today, TZ);
		const total = result.reduce((acc, r) => acc + r.totalCentavos, 0);
		expect(total).toBe(1_00);
	});

	it("formats monthLabel via Intl in the user's TZ", () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const result = bucketSpendByMonth([], today, TZ);
		expect(result[11].monthLabel).toBe("April 2026");
		expect(result[0].monthLabel).toBe("May 2025");
	});
});
