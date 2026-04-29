import { describe, expect, it } from "vitest";
import {
	currentMonthYYYYMM,
	dayOfMonth,
	daysInMonth,
	daysRemaining,
	expectedSpendByToday,
	isEarlyMonth,
	projectedEndOfMonth,
} from "../utils/pacingMath";

const TZ = "Asia/Manila";

describe("daysInMonth", () => {
	it("returns calendar days for a YYYY-MM string", () => {
		expect(daysInMonth("2026-01")).toBe(31);
		expect(daysInMonth("2026-02")).toBe(28);
		expect(daysInMonth("2024-02")).toBe(29);
		expect(daysInMonth("2026-04")).toBe(30);
	});
});

describe("dayOfMonth / currentMonthYYYYMM", () => {
	it("reads day-of-month in the user's timezone", () => {
		// 2026-04-15T01:00:00Z = 2026-04-15 09:00 in Asia/Manila
		expect(dayOfMonth(new Date("2026-04-15T01:00:00Z"), TZ)).toBe(15);
		// 2026-04-30T18:00:00Z = 2026-05-01 02:00 in Asia/Manila
		expect(dayOfMonth(new Date("2026-04-30T18:00:00Z"), TZ)).toBe(1);
	});

	it("returns YYYY-MM in the user's timezone", () => {
		expect(currentMonthYYYYMM(new Date("2026-04-15T01:00:00Z"), TZ)).toBe("2026-04");
		expect(currentMonthYYYYMM(new Date("2026-04-30T18:00:00Z"), TZ)).toBe("2026-05");
	});
});

describe("daysRemaining", () => {
	const today = new Date("2026-04-15T01:00:00Z"); // Apr 15 in PHT
	it("returns full days remaining (excluding today) for the active month", () => {
		expect(daysRemaining(today, TZ, "2026-04")).toBe(15); // 30 - 15
	});
	it("returns 0 for a past month", () => {
		expect(daysRemaining(today, TZ, "2026-03")).toBe(0);
	});
	it("returns the full month for a future month", () => {
		expect(daysRemaining(today, TZ, "2026-05")).toBe(31);
	});
});

describe("expectedSpendByToday (linear pacing)", () => {
	const today = new Date("2026-04-15T01:00:00Z"); // day 15 of 30
	it("returns allocated × dayOfMonth / daysInMonth for active month", () => {
		expect(expectedSpendByToday(30_000_00, today, TZ, "2026-04")).toBe(15_000_00);
	});
	it("returns 0 if allocated ≤ 0", () => {
		expect(expectedSpendByToday(0, today, TZ, "2026-04")).toBe(0);
	});
	it("returns full allocated for a past month", () => {
		expect(expectedSpendByToday(10_000_00, today, TZ, "2026-03")).toBe(10_000_00);
	});
	it("returns 0 for a future month", () => {
		expect(expectedSpendByToday(10_000_00, today, TZ, "2026-05")).toBe(0);
	});
});

describe("projectedEndOfMonth (linear extrapolation)", () => {
	const today = new Date("2026-04-15T01:00:00Z"); // day 15 of 30
	it("returns actual × daysInMonth / dayOfMonth for active month", () => {
		expect(projectedEndOfMonth(5_000_00, today, TZ, "2026-04")).toBe(10_000_00);
	});
	it("returns the actual unchanged for a past month", () => {
		expect(projectedEndOfMonth(8_000_00, today, TZ, "2026-03")).toBe(8_000_00);
	});
	it("returns 0 for a future month", () => {
		expect(projectedEndOfMonth(0, today, TZ, "2026-05")).toBe(0);
	});
});

describe("isEarlyMonth", () => {
	it("treats days 1 and 2 of the active month as early", () => {
		expect(isEarlyMonth(new Date("2026-04-01T01:00:00Z"), TZ, "2026-04")).toBe(true);
		expect(isEarlyMonth(new Date("2026-04-02T01:00:00Z"), TZ, "2026-04")).toBe(true);
		expect(isEarlyMonth(new Date("2026-04-03T01:00:00Z"), TZ, "2026-04")).toBe(false);
	});
	it("treats past months as not-early (pacing fully resolved)", () => {
		expect(isEarlyMonth(new Date("2026-04-15T01:00:00Z"), TZ, "2026-03")).toBe(false);
	});
	it("treats future months as early (no pacing data yet)", () => {
		expect(isEarlyMonth(new Date("2026-04-15T01:00:00Z"), TZ, "2026-05")).toBe(true);
	});
});
