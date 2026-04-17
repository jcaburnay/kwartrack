import type { InferSchema, ReducerCtx } from "spacetimedb/server";
import type spacetimedb from "./schema";

export type AppCtx = ReducerCtx<InferSchema<typeof spacetimedb>>;

// Keep this in sync with src/utils/tagConfig.ts DEFAULT_TAGS.
// The server cannot import client utilities, so duplicate the defaults here for validation.
export const DEFAULT_TAGS_BY_TYPE: Record<string, readonly string[]> = {
	expense: [
		"foods",
		"grocery",
		"transportation",
		"online-shopping",
		"gadgets",
		"bills",
		"pets",
		"personal-care",
		"health",
		"digital-subscriptions",
		"entertainment",
		"clothing",
		"education",
		"travel",
		"housing",
		"insurance",
		"gifts",
	],
	income: ["monthly-salary", "freelance", "interest", "bonus", "gifts"],
	transfer: [],
};

// =============================================================================
// IDENTITY HELPERS
// Resolves alias → primary identity so all devices share the same data (D-09)
// =============================================================================

export function normalizeTagName(tag: string) {
	return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

export function resolveOwner(ctx: AppCtx) {
	const alias = ctx.db.identity_alias.stdbIdentity.find(ctx.sender);
	return alias?.primaryIdentity ?? ctx.sender;
}

export function isAuthorized(ctx: AppCtx, ownerIdentity: ReturnType<typeof resolveOwner>): boolean {
	const resolved = resolveOwner(ctx);
	return ownerIdentity.toHexString() === resolved.toHexString();
}

// applyBalance: applies a debit or credit direction to a sub-account's balanceCentavos.
// Credit sub-accounts use inverted semantics (D-01): expense INCREASES outstanding (0=clean, positive=owed).
// direction "debit" = take money out (expense/transfer-from); "credit" = put money in (income/transfer-to).
// delta is always positive.
export function applyBalance(
	subAccount: { balanceCentavos: bigint; subAccountType: string },
	direction: "debit" | "credit",
	delta: bigint,
): bigint {
	const isCreditSubAccount = subAccount.subAccountType === "credit";
	if (direction === "debit") {
		// Non-credit: balance goes down. Credit: outstanding goes up.
		return isCreditSubAccount
			? subAccount.balanceCentavos + delta
			: subAccount.balanceCentavos - delta;
	} else {
		// Non-credit: balance goes up. Credit: outstanding goes down (payment).
		return isCreditSubAccount
			? subAccount.balanceCentavos - delta
			: subAccount.balanceCentavos + delta;
	}
}

// Compute the microsecond timestamp for the next occurrence based on the interval.
// For weekly/biweekly: adds 7 or 14 days to nowMicros (dayOfMonth anchors only first fire).
// For month-based intervals: advances by N months and pins to dayOfMonth.
// NEVER call with dayOfMonth > 28; enforced at creation time (D-05).
export function computeNextOccurrence(
	nowMicros: bigint,
	interval: string,
	dayOfMonth: number,
): bigint {
	if (interval === "weekly") {
		return nowMicros + 7n * 24n * 60n * 60n * 1_000_000n;
	}
	if (interval === "biweekly") {
		return nowMicros + 14n * 24n * 60n * 60n * 1_000_000n;
	}
	const monthsToAdd =
		interval === "monthly"
			? 1
			: interval === "quarterly"
				? 3
				: interval === "semiannual"
					? 6
					: interval === "yearly"
						? 12
						: (() => {
								throw new Error(`Unknown interval: ${interval}`);
							})();
	const nowMs = Number(nowMicros / 1000n);
	const now = new Date(nowMs);
	let targetYear = now.getUTCFullYear();
	let targetMonth = now.getUTCMonth() + monthsToAdd;
	while (targetMonth > 11) {
		targetMonth -= 12;
		targetYear += 1;
	}
	const fireDate = new Date(Date.UTC(targetYear, targetMonth, dayOfMonth, 0, 0, 0, 0));
	return BigInt(fireDate.getTime()) * 1000n;
}

// Validate the creditLimit / outstanding-balance invariants for a credit sub-account edit.
// Returns a human-readable error message, or null when the edit is acceptable.
// Called from edit_sub_account; lifted out so the invariant is testable in one place.
export function validateCreditAccountEdit(
	creditLimitCentavos: bigint,
	balanceCentavos: bigint | null | undefined,
): string | null {
	if (creditLimitCentavos <= 0n) return "Credit limit must be greater than 0";
	if (balanceCentavos != null) {
		if (balanceCentavos < 0n) return "Outstanding balance cannot be negative";
		if (balanceCentavos > creditLimitCentavos)
			return "Outstanding balance cannot exceed credit limit";
	}
	return null;
}

// Monthly *net* time-deposit interest in centavos, after 20% final withholding tax.
// Formula: principal × (bps/10_000) / 12 × 0.80
// Held in integer space to preserve centavo precision: (principal × bps × 80) / 12_000_000.
// Denominator breakdown: 10_000 (bps→rate) × 12 (months/year) × 100 (1/0.80 inverse) = 12_000_000.
export function computeMonthlyNetInterestCentavos(
	principalCentavos: bigint,
	interestRateBps: number,
): bigint {
	return (principalCentavos * BigInt(interestRateBps) * 80n) / 12_000_000n;
}

// Compute the microsecond timestamp for the first fire of a new/resumed definition.
// Dispatch order:
//   1. weekly/biweekly + anchorDayOfWeek > 0 → next occurrence of that weekday
//   2. quarterly + anchorMonth > 0 → next future occurrence in the 4-month cycle
//   3. semiannual/yearly + anchorMonth > 0 → next future (anchorMonth, dayOfMonth) or +6mo pair
//   4. default → this month if dayOfMonth >= today, else next month
export function computeFirstFireMicros(
	nowMicros: bigint,
	dayOfMonth: number,
	interval: string,
	anchorMonth: number,
	anchorDayOfWeek: number,
): bigint {
	const nowMs = Number(nowMicros / 1000n);
	const now = new Date(nowMs);

	// Case 1: weekly/biweekly with day-of-week anchor
	if (anchorDayOfWeek > 0 && (interval === "weekly" || interval === "biweekly")) {
		// anchorDayOfWeek 1=Mon..6=Sat, 7=Sun → JS getUTCDay() 1=Mon..6=Sat, 0=Sun
		const targetJsDay = anchorDayOfWeek === 7 ? 0 : anchorDayOfWeek;
		const todayJsDay = now.getUTCDay();
		const daysUntil = (targetJsDay - todayJsDay + 7) % 7;
		const targetMs = now.getTime() + daysUntil * 24 * 60 * 60 * 1000;
		const target = new Date(targetMs);
		const fireDate = new Date(
			Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0, 0),
		);
		return BigInt(fireDate.getTime()) * 1000n;
	}

	// Case 2: quarterly with month anchor — fires on anchorMonth, anchorMonth+3, anchorMonth+6, anchorMonth+9
	if (anchorMonth > 0 && interval === "quarterly") {
		const currentYear = now.getUTCFullYear();
		const m0 = anchorMonth - 1; // 0-indexed month
		const fireMonths = [m0, (m0 + 3) % 12, (m0 + 6) % 12, (m0 + 9) % 12];
		const candidates: bigint[] = [];
		for (const y of [currentYear, currentYear + 1]) {
			for (const m of fireMonths) {
				const d = new Date(Date.UTC(y, m, dayOfMonth, 0, 0, 0, 0));
				if (d > now) candidates.push(BigInt(d.getTime()) * 1000n);
			}
		}
		const sorted = candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		if (sorted.length === 0)
			throw new Error(
				`computeFirstFireMicros: no quarterly candidate found for anchorMonth=${anchorMonth}`,
			);
		return sorted[0];
	}

	// Case 3: semiannual/yearly with month anchor
	if (anchorMonth > 0 && (interval === "semiannual" || interval === "yearly")) {
		const currentYear = now.getUTCFullYear();
		const m0 = anchorMonth - 1; // 0-indexed month

		if (interval === "yearly") {
			for (const y of [currentYear, currentYear + 1]) {
				const d = new Date(Date.UTC(y, m0, dayOfMonth, 0, 0, 0, 0));
				if (d > now) return BigInt(d.getTime()) * 1000n;
			}
			// Unreachable with valid dayOfMonth (1–28), but guard for clarity
			throw new Error(
				`computeFirstFireMicros: no future yearly date found for anchorMonth=${anchorMonth}`,
			);
		}

		// semiannual fires on anchorMonth and anchorMonth+6 months
		const m1 = m0;
		const m2 = (m0 + 6) % 12;
		const candidates: bigint[] = [];
		for (const y of [currentYear, currentYear + 1]) {
			for (const m of [m1, m2]) {
				const d = new Date(Date.UTC(y, m, dayOfMonth, 0, 0, 0, 0));
				if (d > now) candidates.push(BigInt(d.getTime()) * 1000n);
			}
		}
		const sorted = candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		if (sorted.length === 0)
			throw new Error(
				`computeFirstFireMicros: no semiannual candidate found for anchorMonth=${anchorMonth}`,
			);
		return sorted[0];
	}

	// Case 4: default — fire this month or next month based on dayOfMonth
	const todayDay = now.getUTCDate();
	let targetYear = now.getUTCFullYear();
	let targetMonth = now.getUTCMonth();
	if (dayOfMonth < todayDay) {
		targetMonth += 1;
		if (targetMonth > 11) {
			targetMonth = 0;
			targetYear += 1;
		}
	}
	const fireDate = new Date(Date.UTC(targetYear, targetMonth, dayOfMonth, 0, 0, 0, 0));
	return BigInt(fireDate.getTime()) * 1000n;
}
