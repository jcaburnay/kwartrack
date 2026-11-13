import { describe, expect, it } from "vitest";
import {
	activeBudgetPeriod,
	defaultBudgetEnd,
	periodPacing,
	validateBudgetRange,
} from "../utils/budgetPeriod";

const period = { id: "p1", start_date: "2026-11-15", end_date: "2026-12-15" };
describe("budget period dates", () => {
	it("defaults to the same day next month, clamping month ends", () => {
		expect(defaultBudgetEnd("2026-11-15")).toBe("2026-12-15");
		expect(defaultBudgetEnd("2026-01-31")).toBe("2026-02-28");
		expect(defaultBudgetEnd("2028-01-31")).toBe("2028-02-29");
		expect(defaultBudgetEnd("2026-12-21")).toBe("2027-01-21");
	});
	it("includes both boundary dates and leaves gaps inactive", () => {
		const periods = [period, { id: "p2", start_date: "2026-12-21", end_date: "2027-01-21" }];
		expect(activeBudgetPeriod(periods, "2026-11-15")?.id).toBe("p1");
		expect(activeBudgetPeriod(periods, "2026-12-15")?.id).toBe("p1");
		expect(activeBudgetPeriod(periods, "2026-12-16")).toBeNull();
		expect(activeBudgetPeriod(periods, "2026-12-21")?.id).toBe("p2");
	});
	it("uses inclusive days, including same-day periods and past/future pacing", () => {
		expect(periodPacing(period, "2026-11-15")).toEqual({
			totalDays: 31,
			elapsedDays: 1,
			daysLeft: 30,
		});
		expect(periodPacing(period, "2026-12-15")).toEqual({
			totalDays: 31,
			elapsedDays: 31,
			daysLeft: 0,
		});
		expect(periodPacing(period, "2026-11-14")).toEqual({
			totalDays: 31,
			elapsedDays: 0,
			daysLeft: 31,
		});
		expect(periodPacing(period, "2026-12-16")).toEqual({
			totalDays: 31,
			elapsedDays: 31,
			daysLeft: 0,
		});
		expect(
			periodPacing({ start_date: "2026-11-15", end_date: "2026-11-15" }, "2026-11-15").totalDays,
		).toBe(1);
	});
	it("rejects invalid, reversed and overlapping ranges but accepts adjacent dates", () => {
		expect(
			validateBudgetRange({ start_date: "2026-02-30", end_date: "2026-03-15" }, []),
		).toBeTruthy();
		expect(
			validateBudgetRange({ start_date: "2026-12-15", end_date: "2026-11-15" }, []),
		).toBeTruthy();
		expect(
			validateBudgetRange({ start_date: "2026-12-15", end_date: "2027-01-15" }, [period]),
		).toBeTruthy();
		expect(
			validateBudgetRange({ start_date: "2026-12-16", end_date: "2027-01-15" }, [period]),
		).toBeNull();
		expect(validateBudgetRange(period, [period], period.id)).toBeNull();
	});
});
