import { describe, expect, it } from "vitest";
import { formatTransactionDate } from "../utils/transactionDateFormat";

const TZ = "Asia/Manila";
const today = new Date("2026-04-15T03:00:00Z"); // 11:00 AM Manila

describe("formatTransactionDate", () => {
	it("renders Today for today's date", () => {
		expect(formatTransactionDate("2026-04-15", today, TZ)).toBe("Today");
	});

	it("renders Yesterday for the day before", () => {
		expect(formatTransactionDate("2026-04-14", today, TZ)).toBe("Yesterday");
	});

	it("renders short month + day for older dates this year", () => {
		expect(formatTransactionDate("2026-04-01", today, TZ)).toBe("Apr 1");
		expect(formatTransactionDate("2026-01-09", today, TZ)).toBe("Jan 9");
	});

	it("includes year for dates in a different year", () => {
		expect(formatTransactionDate("2025-12-31", today, TZ)).toBe("Dec 31, 2025");
	});

	it("renders future dates with the same rules", () => {
		expect(formatTransactionDate("2026-04-16", today, TZ)).toBe("Apr 16");
	});
});
