import { describe, expect, it } from "vitest";
import type { AppCtx } from "../helpers";
import {
	applyBalance,
	computeFirstFireMicros,
	computeMonthlyNetInterestCentavos,
	computeNextOccurrence,
	isAuthorized,
	normalizeTagName,
	resolveOwner,
	validateCreditAccountEdit,
} from "../helpers";

// =============================================================================
// applyBalance — the core balance mutation used by every transaction reducer.
// Credit sub-accounts use INVERTED semantics: expense increases outstanding
// (balance goes UP on debit), payment decreases it (balance goes DOWN on credit).
// =============================================================================

describe("applyBalance", () => {
	const wallet = (balance: bigint) => ({ balanceCentavos: balance, subAccountType: "wallet" });
	const credit = (balance: bigint) => ({ balanceCentavos: balance, subAccountType: "credit" });

	describe("wallet / non-credit sub-account", () => {
		it("debit subtracts delta from balance", () => {
			expect(applyBalance(wallet(100_00n), "debit", 30_00n)).toBe(70_00n);
		});

		it("credit adds delta to balance", () => {
			expect(applyBalance(wallet(100_00n), "credit", 30_00n)).toBe(130_00n);
		});

		it("debit can push balance negative (overdraft)", () => {
			expect(applyBalance(wallet(10_00n), "debit", 50_00n)).toBe(-40_00n);
		});

		it("zero delta is a no-op in either direction", () => {
			expect(applyBalance(wallet(100_00n), "debit", 0n)).toBe(100_00n);
			expect(applyBalance(wallet(100_00n), "credit", 0n)).toBe(100_00n);
		});

		it("handles very large BigInt amounts without precision loss", () => {
			const huge = 9_999_999_999_99n; // ₱99,999,999,999.99
			expect(applyBalance(wallet(0n), "credit", huge)).toBe(huge);
			expect(applyBalance(wallet(huge), "debit", huge)).toBe(0n);
		});
	});

	describe("credit sub-account (inverted semantics)", () => {
		it("debit INCREASES outstanding (expense charged to card)", () => {
			// 0 = clean card, after charging 500 pesos outstanding is 500 pesos
			expect(applyBalance(credit(0n), "debit", 500_00n)).toBe(500_00n);
		});

		it("credit DECREASES outstanding (payment to card)", () => {
			// Owe 500, pay 200, still owe 300
			expect(applyBalance(credit(500_00n), "credit", 200_00n)).toBe(300_00n);
		});

		it("overpaying a credit card produces a negative outstanding (credit balance)", () => {
			// Owe 100, pay 300, card now has 200 credit balance
			expect(applyBalance(credit(100_00n), "credit", 300_00n)).toBe(-200_00n);
		});

		it("debit from a negative outstanding draws down the credit balance first", () => {
			// Card has ₱200 credit balance (overpaid). Charge ₱50 — outstanding becomes -150.
			expect(applyBalance(credit(-200_00n), "debit", 50_00n)).toBe(-150_00n);
		});
	});

	describe("inversion is symmetric", () => {
		it("debit then credit of the same delta returns to the starting balance (wallet)", () => {
			const start = 1_000_00n;
			const afterDebit = applyBalance(wallet(start), "debit", 250_00n);
			const afterCredit = applyBalance(
				{ balanceCentavos: afterDebit, subAccountType: "wallet" },
				"credit",
				250_00n,
			);
			expect(afterCredit).toBe(start);
		});

		it("debit then credit of the same delta returns to the starting balance (credit)", () => {
			const start = 0n;
			const afterCharge = applyBalance(credit(start), "debit", 750_00n);
			const afterPayment = applyBalance(
				{ balanceCentavos: afterCharge, subAccountType: "credit" },
				"credit",
				750_00n,
			);
			expect(afterPayment).toBe(start);
		});
	});
});

// =============================================================================
// normalizeTagName — tag canonicalisation used everywhere custom tags are accepted
// =============================================================================

describe("normalizeTagName", () => {
	it("lowercases mixed-case input", () => {
		expect(normalizeTagName("Foods")).toBe("foods");
	});

	it("replaces interior whitespace with dashes", () => {
		expect(normalizeTagName("online shopping")).toBe("online-shopping");
	});

	it("collapses runs of whitespace into a single dash", () => {
		expect(normalizeTagName("pet   care")).toBe("pet-care");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeTagName("  gadgets  ")).toBe("gadgets");
	});

	it("is idempotent on already-normalised names", () => {
		expect(normalizeTagName("digital-subscriptions")).toBe("digital-subscriptions");
	});
});

// =============================================================================
// computeFirstFireMicros — scheduling math for recurring definitions.
// Four dispatch cases, each with edge cases around month/year rollover.
// All inputs are UTC; tests build fixed "now" timestamps from Date.UTC so they
// don't depend on the runner's local timezone or current date.
// =============================================================================

const micros = (d: Date) => BigInt(d.getTime()) * 1000n;
const utc = (y: number, monthIndex: number, day: number, hour = 12) =>
	new Date(Date.UTC(y, monthIndex, day, hour, 0, 0, 0));

const expectedFire = (y: number, monthIndex: number, day: number) =>
	micros(new Date(Date.UTC(y, monthIndex, day, 0, 0, 0, 0)));

describe("computeFirstFireMicros — case 1: weekly/biweekly with anchorDayOfWeek", () => {
	it("returns the next occurrence of the anchored weekday", () => {
		// April 15, 2026 is a Wednesday (UTC day-of-week 3).
		// Anchor = Monday (1) → daysUntil = (1 - 3 + 7) % 7 = 5 → April 20.
		const now = utc(2026, 3, 15);
		const result = computeFirstFireMicros(micros(now), 20, "weekly", 0, 1);
		expect(result).toBe(expectedFire(2026, 3, 20));
	});

	it("treats Sunday (anchorDayOfWeek=7) as JS getUTCDay()=0", () => {
		// April 13, 2026 is a Monday (JS day 1). Target Sunday (7 → JS 0).
		// daysUntil = (0 - 1 + 7) % 7 = 6 → April 19.
		const now = utc(2026, 3, 13);
		const result = computeFirstFireMicros(micros(now), 19, "weekly", 0, 7);
		expect(result).toBe(expectedFire(2026, 3, 19));
	});

	it("fires same day (time zeroed to 00:00 UTC) when today IS the anchor weekday", () => {
		// April 15, 2026 = Wednesday. Anchor = Wednesday (3) → daysUntil = 0.
		const now = utc(2026, 3, 15, 18);
		const result = computeFirstFireMicros(micros(now), 15, "weekly", 0, 3);
		expect(result).toBe(expectedFire(2026, 3, 15));
	});

	it("applies the same rule for biweekly (same first-fire — cadence kicks in on later fires)", () => {
		const now = utc(2026, 3, 15);
		const result = computeFirstFireMicros(micros(now), 20, "biweekly", 0, 1);
		expect(result).toBe(expectedFire(2026, 3, 20));
	});

	it("falls through to case 4 when anchorDayOfWeek is 0 even for weekly interval", () => {
		// anchorDayOfWeek=0 disables weekday anchoring → dayOfMonth-based dispatch.
		const now = utc(2026, 3, 15);
		const result = computeFirstFireMicros(micros(now), 20, "weekly", 0, 0);
		expect(result).toBe(expectedFire(2026, 3, 20));
	});
});

describe("computeFirstFireMicros — case 2: quarterly with anchorMonth", () => {
	it("picks the next quarter-month in the current year when available", () => {
		// Anchor = January (1) → fires [Jan, Apr, Jul, Oct]. Now = March 2026, dayOfMonth=15.
		// Candidates in 2026: Apr 15, Jul 15, Oct 15 (Jan 15 is past). Next = Apr 15.
		const now = utc(2026, 2, 10);
		const result = computeFirstFireMicros(micros(now), 15, "quarterly", 1, 0);
		expect(result).toBe(expectedFire(2026, 3, 15));
	});

	it("rolls over to next year when all current-year candidates are in the past", () => {
		// Anchor = January (1). Now = late December 2026 after Dec 15.
		// fireMonths = [0, 3, 6, 9]. All 2026 candidates on day=5: Jan 5, Apr 5, Jul 5, Oct 5 — all past.
		// First 2027 candidate at day=5 is Jan 5 2027.
		const now = utc(2026, 11, 20);
		const result = computeFirstFireMicros(micros(now), 5, "quarterly", 1, 0);
		expect(result).toBe(expectedFire(2027, 0, 5));
	});

	it("handles anchorMonth that wraps (e.g. Nov → Nov, Feb, May, Aug)", () => {
		// Anchor = November (11). fireMonths = [10, 1, 4, 7].
		// Now = April 15 2026, day=10. 2026 candidates >now: May 10, Aug 10, Nov 10.
		// Next = May 10 2026.
		const now = utc(2026, 3, 15);
		const result = computeFirstFireMicros(micros(now), 10, "quarterly", 11, 0);
		expect(result).toBe(expectedFire(2026, 4, 10));
	});
});

describe("computeFirstFireMicros — case 3: semiannual/yearly with anchorMonth", () => {
	it("yearly fires on anchorMonth of the current year if still in the future", () => {
		// Anchor = June (6). Now = January 2026. Target = June 15 2026.
		const now = utc(2026, 0, 5);
		const result = computeFirstFireMicros(micros(now), 15, "yearly", 6, 0);
		expect(result).toBe(expectedFire(2026, 5, 15));
	});

	it("yearly rolls over to next year when anchorMonth is already past", () => {
		// Anchor = March (3). Now = October 2026. Target = March 2027.
		const now = utc(2026, 9, 10);
		const result = computeFirstFireMicros(micros(now), 15, "yearly", 3, 0);
		expect(result).toBe(expectedFire(2027, 2, 15));
	});

	it("semiannual fires on anchorMonth and anchorMonth+6 — picks nearest future", () => {
		// Anchor = March (3) → fires in March and September. Now = April 2026.
		// March 2026 is past → next is September 15 2026.
		const now = utc(2026, 3, 1);
		const result = computeFirstFireMicros(micros(now), 15, "semiannual", 3, 0);
		expect(result).toBe(expectedFire(2026, 8, 15));
	});

	it("semiannual anchorMonth+6 correctly wraps past December", () => {
		// Anchor = September (9) → fires Sept and (9+6)%12 = March of next year.
		// Now = October 2026. Sept 2026 is past → next is March 2027.
		const now = utc(2026, 9, 5);
		const result = computeFirstFireMicros(micros(now), 15, "semiannual", 9, 0);
		expect(result).toBe(expectedFire(2027, 2, 15));
	});
});

// =============================================================================
// computeNextOccurrence — scheduling math for every fire AFTER the first.
// Weekly/biweekly are pure offsets from nowMicros; month-based intervals pin
// dayOfMonth and advance by N months with year rollover.
// =============================================================================

describe("computeNextOccurrence — weekly / biweekly fixed offsets", () => {
	it("weekly adds exactly 7 days of microseconds", () => {
		const now = micros(utc(2026, 3, 15, 12));
		const sevenDaysMicros = 7n * 24n * 60n * 60n * 1_000_000n;
		expect(computeNextOccurrence(now, "weekly", 15)).toBe(now + sevenDaysMicros);
	});

	it("biweekly adds exactly 14 days of microseconds", () => {
		const now = micros(utc(2026, 3, 15, 12));
		const fourteenDaysMicros = 14n * 24n * 60n * 60n * 1_000_000n;
		expect(computeNextOccurrence(now, "biweekly", 15)).toBe(now + fourteenDaysMicros);
	});

	it("weekly ignores dayOfMonth (by design — only first-fire anchors the day)", () => {
		const now = micros(utc(2026, 3, 15, 12));
		expect(computeNextOccurrence(now, "weekly", 1)).toBe(computeNextOccurrence(now, "weekly", 28));
	});
});

describe("computeNextOccurrence — month-based intervals", () => {
	it("monthly advances by 1 month, pinning dayOfMonth", () => {
		const now = micros(utc(2026, 3, 15));
		expect(computeNextOccurrence(now, "monthly", 15)).toBe(expectedFire(2026, 4, 15));
	});

	it("quarterly advances by 3 months", () => {
		const now = micros(utc(2026, 3, 15));
		expect(computeNextOccurrence(now, "quarterly", 15)).toBe(expectedFire(2026, 6, 15));
	});

	it("semiannual advances by 6 months", () => {
		const now = micros(utc(2026, 3, 15));
		expect(computeNextOccurrence(now, "semiannual", 15)).toBe(expectedFire(2026, 9, 15));
	});

	it("yearly advances by 12 months (same month next year)", () => {
		const now = micros(utc(2026, 3, 15));
		expect(computeNextOccurrence(now, "yearly", 15)).toBe(expectedFire(2027, 3, 15));
	});

	it("rolls year forward when adding months crosses December", () => {
		// Monthly from November → December (same year)
		const novNow = micros(utc(2026, 10, 15));
		expect(computeNextOccurrence(novNow, "monthly", 15)).toBe(expectedFire(2026, 11, 15));

		// Monthly from December → January (next year)
		const decNow = micros(utc(2026, 11, 15));
		expect(computeNextOccurrence(decNow, "monthly", 15)).toBe(expectedFire(2027, 0, 15));

		// Quarterly from November → February (next year)
		const novToQuarter = micros(utc(2026, 10, 10));
		expect(computeNextOccurrence(novToQuarter, "quarterly", 10)).toBe(expectedFire(2027, 1, 10));

		// Semiannual from September → March (next year)
		const septNow = micros(utc(2026, 8, 10));
		expect(computeNextOccurrence(septNow, "semiannual", 10)).toBe(expectedFire(2027, 2, 10));
	});

	it("throws on unknown interval", () => {
		const now = micros(utc(2026, 3, 15));
		expect(() => computeNextOccurrence(now, "daily", 15)).toThrow(/Unknown interval/);
	});
});

describe("computeFirstFireMicros — case 4: default monthly dispatch", () => {
	it("fires this month when dayOfMonth >= today", () => {
		// Now = April 10 2026, dayOfMonth = 20 → April 20 2026.
		const now = utc(2026, 3, 10);
		const result = computeFirstFireMicros(micros(now), 20, "monthly", 0, 0);
		expect(result).toBe(expectedFire(2026, 3, 20));
	});

	it("fires next month when dayOfMonth < today", () => {
		// Now = April 20 2026, dayOfMonth = 5 → May 5 2026.
		const now = utc(2026, 3, 20);
		const result = computeFirstFireMicros(micros(now), 5, "monthly", 0, 0);
		expect(result).toBe(expectedFire(2026, 4, 5));
	});

	it("rolls over year when moving to next month past December", () => {
		// Now = Dec 20 2026, dayOfMonth = 5 → Jan 5 2027.
		const now = utc(2026, 11, 20);
		const result = computeFirstFireMicros(micros(now), 5, "monthly", 0, 0);
		expect(result).toBe(expectedFire(2027, 0, 5));
	});

	it("fires today (time zeroed to 00:00 UTC) when dayOfMonth === today", () => {
		// Now = April 15 2026 at 18:00, dayOfMonth = 15 → fireDate is April 15 2026 00:00 UTC
		// (which is before `now` — the function does NOT guard against this;
		// this test pins that behaviour so a future change is deliberate).
		const now = utc(2026, 3, 15, 18);
		const result = computeFirstFireMicros(micros(now), 15, "monthly", 0, 0);
		expect(result).toBe(expectedFire(2026, 3, 15));
	});
});

// =============================================================================
// computeMonthlyNetInterestCentavos — integer math for time-deposit interest
// after 20% withholding tax. Formula: (principal × bps × 80) / 12_000_000.
// =============================================================================

describe("computeMonthlyNetInterestCentavos", () => {
	it("computes expected monthly net for a typical time deposit", () => {
		// ₱100,000 principal at 4% annual rate (400 bps):
		// gross monthly = 100_000 × 0.04 / 12 = ₱333.33
		// net monthly (after 20% tax) = ₱266.66 → 26_666 centavos (integer floor)
		const principal = 100_000_00n; // 10_000_000 centavos
		const net = computeMonthlyNetInterestCentavos(principal, 400);
		expect(net).toBe(26_666n);
	});

	it("returns 0n when the formula underflows integer centavos", () => {
		// Tiny principal + tiny rate → rounds to zero in integer space.
		// 1 centavo × 1 bps × 80 / 12_000_000 = 0
		expect(computeMonthlyNetInterestCentavos(1n, 1)).toBe(0n);
	});

	it("scales linearly with principal", () => {
		const single = computeMonthlyNetInterestCentavos(1_000_000n, 500);
		const double = computeMonthlyNetInterestCentavos(2_000_000n, 500);
		expect(double).toBe(single * 2n);
	});

	it("scales linearly with interest rate (within integer-truncation tolerance)", () => {
		const at100Bps = computeMonthlyNetInterestCentavos(12_000_000n, 100);
		const at300Bps = computeMonthlyNetInterestCentavos(12_000_000n, 300);
		// Pick a principal that divides cleanly — 12_000_000 × bps × 80 / 12_000_000 = bps × 80.
		expect(at100Bps).toBe(8_000n);
		expect(at300Bps).toBe(24_000n);
	});

	it("floors rather than rounds (integer BigInt division)", () => {
		// Principal chosen so gross * 80 = 12_000_000n + 1 → floor to 1n, not 2n.
		// 150_001 × 1 bps × 80 = 12_000_080; / 12_000_000 = 1 (remainder 80 discarded).
		expect(computeMonthlyNetInterestCentavos(150_001n, 1)).toBe(1n);
	});

	it("zero principal or zero rate yields zero", () => {
		expect(computeMonthlyNetInterestCentavos(0n, 500)).toBe(0n);
		expect(computeMonthlyNetInterestCentavos(1_000_000n, 0)).toBe(0n);
	});
});

// =============================================================================
// resolveOwner / isAuthorized — per-user data isolation. Both use ctx.db and
// ctx.sender. We build a tiny stub ctx that implements only the two calls the
// helpers make: identity_alias.stdbIdentity.find() and Identity.toHexString().
// =============================================================================

type StubIdentity = { toHexString: () => string };

const mkIdentity = (hex: string): StubIdentity => ({ toHexString: () => hex });

const mkCtx = (opts: {
	sender: StubIdentity;
	aliases?: { stdbIdentity: StubIdentity; primaryIdentity: StubIdentity }[];
}): AppCtx =>
	({
		sender: opts.sender,
		db: {
			identity_alias: {
				stdbIdentity: {
					find: (identity: StubIdentity) =>
						opts.aliases?.find((a) => a.stdbIdentity.toHexString() === identity.toHexString()),
				},
			},
		},
		// biome-ignore lint/suspicious/noExplicitAny: test stub intentionally satisfies only the narrow ctx surface used by resolveOwner / isAuthorized
	}) as any;

describe("resolveOwner", () => {
	it("returns the sender itself when no alias is registered", () => {
		const sender = mkIdentity("0xsender");
		const ctx = mkCtx({ sender });
		expect(resolveOwner(ctx)).toBe(sender);
	});

	it("returns the primaryIdentity when an alias exists for the sender", () => {
		const device = mkIdentity("0xdevice2");
		const primary = mkIdentity("0xprimary");
		const ctx = mkCtx({
			sender: device,
			aliases: [{ stdbIdentity: device, primaryIdentity: primary }],
		});
		expect(resolveOwner(ctx)).toBe(primary);
	});

	it("ignores aliases that don't match ctx.sender", () => {
		const sender = mkIdentity("0xsender");
		const otherDevice = mkIdentity("0xother");
		const otherPrimary = mkIdentity("0xotherprimary");
		const ctx = mkCtx({
			sender,
			aliases: [{ stdbIdentity: otherDevice, primaryIdentity: otherPrimary }],
		});
		expect(resolveOwner(ctx)).toBe(sender);
	});
});

describe("isAuthorized", () => {
	it("returns true when ownerIdentity matches the sender's resolved owner", () => {
		const sender = mkIdentity("0xowner");
		const ctx = mkCtx({ sender });
		// Row owned by the same identity the sender resolves to.
		expect(isAuthorized(ctx, mkIdentity("0xowner") as never)).toBe(true);
	});

	it("returns true when ownerIdentity matches the alias-resolved primary identity", () => {
		// Classic multi-device case: a row was created on device 1 (primary identity)
		// and is now being touched from device 2 (an alias). Auth must succeed.
		const primary = mkIdentity("0xprimary");
		const device2 = mkIdentity("0xdevice2");
		const ctx = mkCtx({
			sender: device2,
			aliases: [{ stdbIdentity: device2, primaryIdentity: primary }],
		});
		expect(isAuthorized(ctx, primary as never)).toBe(true);
	});

	it("returns false when ownerIdentity belongs to a different user", () => {
		const sender = mkIdentity("0xmine");
		const otherOwner = mkIdentity("0xsomeoneElse");
		const ctx = mkCtx({ sender });
		expect(isAuthorized(ctx, otherOwner as never)).toBe(false);
	});

	it("returns false when only the device identity matches but the data is owned by the primary", () => {
		// Inverse of the alias-resolve case: sender is the PRIMARY, row is tagged with a DEVICE identity.
		// resolveOwner returns the sender (primary), which won't match the device identity.
		const primary = mkIdentity("0xprimary");
		const device = mkIdentity("0xdevice2");
		const ctx = mkCtx({ sender: primary });
		expect(isAuthorized(ctx, device as never)).toBe(false);
	});
});

// =============================================================================
// validateCreditAccountEdit — domain invariants for credit sub-account edits.
// Returns a user-facing error message string, or null when the edit is valid.
// =============================================================================

describe("validateCreditAccountEdit", () => {
	it("accepts a positive credit limit with no balance update", () => {
		expect(validateCreditAccountEdit(100_000_00n, null)).toBeNull();
		expect(validateCreditAccountEdit(100_000_00n, undefined)).toBeNull();
	});

	it("accepts a positive credit limit with a balance within range", () => {
		expect(validateCreditAccountEdit(100_000_00n, 0n)).toBeNull();
		expect(validateCreditAccountEdit(100_000_00n, 50_000_00n)).toBeNull();
		expect(validateCreditAccountEdit(100_000_00n, 100_000_00n)).toBeNull();
	});

	it("rejects a zero or negative credit limit regardless of balance", () => {
		expect(validateCreditAccountEdit(0n, null)).toBe("Credit limit must be greater than 0");
		expect(validateCreditAccountEdit(-1n, null)).toBe("Credit limit must be greater than 0");
		// Balance check is skipped when limit is invalid — limit error surfaces first.
		expect(validateCreditAccountEdit(0n, 50_000_00n)).toBe("Credit limit must be greater than 0");
	});

	it("rejects a negative outstanding balance", () => {
		expect(validateCreditAccountEdit(100_000_00n, -1n)).toBe(
			"Outstanding balance cannot be negative",
		);
	});

	it("rejects a balance exceeding the credit limit", () => {
		expect(validateCreditAccountEdit(100_000_00n, 100_000_01n)).toBe(
			"Outstanding balance cannot exceed credit limit",
		);
	});

	it("checks the credit limit before the balance", () => {
		// Both invalid — should return the limit message since that runs first.
		expect(validateCreditAccountEdit(0n, -50_000_00n)).toBe("Credit limit must be greater than 0");
	});
});
