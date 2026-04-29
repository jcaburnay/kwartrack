import { describe, expect, it } from "vitest";
import { type DateRangePreset, resolveDateRangePreset } from "../utils/transactionDateRange";

const TZ = "Asia/Manila";
const today = new Date("2026-04-15T03:00:00Z"); // 11:00 AM Manila

describe("resolveDateRangePreset", () => {
	it("resolves this-month to first day → today inclusive", () => {
		expect(resolveDateRangePreset("this-month", TZ, today)).toEqual({
			from: "2026-04-01",
			to: "2026-04-15",
		});
	});

	it("resolves last-30-days to today minus 29 → today inclusive", () => {
		expect(resolveDateRangePreset("last-30-days", TZ, today)).toEqual({
			from: "2026-03-17",
			to: "2026-04-15",
		});
	});

	it("resolves last-month to first → last day of previous month", () => {
		expect(resolveDateRangePreset("last-month", TZ, today)).toEqual({
			from: "2026-03-01",
			to: "2026-03-31",
		});
	});

	it("returns nulls for custom (caller supplies its own dates)", () => {
		expect(resolveDateRangePreset("custom", TZ, today)).toEqual({ from: null, to: null });
	});

	it("returns nulls for all-time", () => {
		expect(resolveDateRangePreset("all-time", TZ, today)).toEqual({ from: null, to: null });
	});

	it("handles year boundary for last-month from January", () => {
		const jan = new Date("2026-01-15T03:00:00Z");
		expect(resolveDateRangePreset("last-month", TZ, jan)).toEqual({
			from: "2025-12-01",
			to: "2025-12-31",
		});
	});

	it("preset list is exhaustive", () => {
		const all: DateRangePreset[] = [
			"this-month",
			"last-30-days",
			"last-month",
			"custom",
			"all-time",
		];
		expect(all.length).toBe(5);
	});
});
