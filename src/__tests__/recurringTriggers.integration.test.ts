/**
 * Integration tests for Slice 6 (Recurring) DB-level mechanics:
 *   - recurring_set_next_at BEFORE trigger (initial materialization, monthly
 *     clamp anchor preservation, edit-driven recompute, pause→resume).
 *   - recurring_fire_due() cron entrypoint (single fire, catchup, completion,
 *     pause skip, transfer fee paired-row, FK SET NULL on delete).
 *
 * Skipped without SUPABASE_SECRET_KEY (mirrors balanceTriggers pattern).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const canRun = Boolean(url && secretKey);
const runOrSkip = canRun ? describe : describe.skip;

let admin: SupabaseClient<Database>;
let userId = "";
let cashId = "";
let walletId = "";
let foodsTagId = "";
let salaryTagId = "";

const TZ = "Asia/Manila";

function todayInTZ(): string {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return fmt.format(new Date());
}

function shiftDays(isoDate: string, deltaDays: number): string {
	const d = new Date(`${isoDate}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + deltaDays);
	return d.toISOString().slice(0, 10);
}

async function fireDue(): Promise<number> {
	const { data, error } = await admin.rpc("recurring_fire_due");
	if (error) throw error;
	return data ?? 0;
}

async function setNextAtPast(recurringId: string, minutesAgo = 1) {
	// Bypass the BEFORE trigger's no-op-on-non-schedule-changes branch by
	// using a raw psql-style update via supabase. The trigger only recomputes
	// when interval/anchor/paused-toggle changes; updating next_occurrence_at
	// alone is preserved.
	const past = new Date(Date.now() - minutesAgo * 60_000).toISOString();
	const { error } = await admin
		.from("recurring")
		.update({ next_occurrence_at: past })
		.eq("id", recurringId);
	if (error) throw error;
}

async function wipeRecurringsAndTransactions() {
	// Delete recurrings first: transaction.recurring_id ON DELETE SET NULL,
	// so transactions stick around and get cleaned up next.
	await admin.from("recurring").delete().eq("user_id", userId);
	await admin.from("transaction").delete().eq("user_id", userId).is("parent_transaction_id", null);
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });

	const email = `recurring+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password: "integration-test-pw-1234",
		email_confirm: true,
		user_metadata: { display_name: "Recurring Test", timezone: TZ },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	const { data: tags } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	foodsTagId = tags!.find((t) => t.name === "foods" && t.type === "expense" && !t.is_system)!.id;
	salaryTagId = tags!.find(
		(t) => t.name === "monthly-salary" && t.type === "income" && !t.is_system,
	)!.id;

	const { data: cash } = await admin
		.from("account")
		.insert({ user_id: userId, name: "Cash", type: "cash", initial_balance_centavos: 100_000_00 })
		.select("id")
		.single();
	cashId = cash!.id;

	const { data: wallet } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Wallet",
			type: "e-wallet",
			initial_balance_centavos: 50_000_00,
		})
		.select("id")
		.single();
	walletId = wallet!.id;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	if (userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await wipeRecurringsAndTransactions();
});

runOrSkip("recurring_set_next_at trigger", () => {
	it("materializes next_at to midnight-local on a future anchor", async () => {
		const future = shiftDays(todayInTZ(), 5);
		const { data, error } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "future sub",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: future,
				next_occurrence_at: new Date().toISOString(), // overwritten by trigger
			})
			.select("next_occurrence_at, first_occurrence_date")
			.single();
		expect(error).toBeNull();
		expect(data!.first_occurrence_date).toBe(future);
		// Midnight local on `future` in Asia/Manila = 16:00:00 UTC the day before.
		const expected = `${shiftDays(future, -1)}T16:00:00`;
		expect(data!.next_occurrence_at.startsWith(expected)).toBe(true);
	});

	it("steps a past anchor forward to the first future occurrence (monthly)", async () => {
		const today = todayInTZ();
		// Anchor 35 days in the past — first future monthly fire is one month
		// from anchor day, possibly this month.
		const pastAnchor = shiftDays(today, -35);
		const { data } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "past anchor",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: pastAnchor,
				next_occurrence_at: new Date().toISOString(),
			})
			.select("next_occurrence_at")
			.single();
		const nextDate = new Date(data!.next_occurrence_at);
		expect(nextDate.getTime()).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000);
	});
});

runOrSkip("advance_recurring_next monthly clamp", () => {
	// Verify the clamp directly against the SQL helper rather than the cron
	// loop — keeps the test independent of `now()`. Anchor Jan 31 should
	// produce Feb 28, Mar 31, Apr 30, May 31, … with the original day-of-month
	// preserved through short-month clamps.
	async function advance(currentLocalDate: string): Promise<string> {
		const { data, error } = await admin.rpc("advance_recurring_next", {
			p_anchor: "2026-01-31",
			p_interval: "monthly",
			p_current_next: `${currentLocalDate}T00:00:00+08:00`,
			p_tz: TZ,
		});
		if (error) throw error;
		// Convert returned timestamptz back to a local date in Asia/Manila.
		const fmt = new Intl.DateTimeFormat("en-CA", {
			timeZone: TZ,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		return fmt.format(new Date(data as string));
	}

	it("Jan 31 → Feb 28 → Mar 31 → Apr 30 (anchor preserved)", async () => {
		expect(await advance("2026-01-31")).toBe("2026-02-28");
		expect(await advance("2026-02-28")).toBe("2026-03-31");
		expect(await advance("2026-03-31")).toBe("2026-04-30");
		expect(await advance("2026-04-30")).toBe("2026-05-31");
	});

	it("Feb 29 leap → Feb 28 next year (annual clamp)", async () => {
		const { data, error } = await admin.rpc("advance_recurring_next", {
			p_anchor: "2024-02-29",
			p_interval: "annual",
			p_current_next: "2024-02-29T00:00:00+08:00",
			p_tz: TZ,
		});
		expect(error).toBeNull();
		const fmt = new Intl.DateTimeFormat("en-CA", {
			timeZone: TZ,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		expect(fmt.format(new Date(data as string))).toBe("2025-02-28");
	});
});

runOrSkip("recurring_fire_due", () => {
	it("creates a tx, links recurring_id, and advances next_occurrence_at", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "spotify",
				amount_centavos: 279_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: todayInTZ(),
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id, next_occurrence_at")
			.single();
		await setNextAtPast(rec!.id);

		const fired = await fireDue();
		expect(fired).toBe(1);

		const { data: txs } = await admin
			.from("transaction")
			.select("amount_centavos, recurring_id")
			.eq("recurring_id", rec!.id);
		expect(txs!.length).toBe(1);
		expect(txs![0].amount_centavos).toBe(279_00);

		const { data: after } = await admin
			.from("recurring")
			.select("next_occurrence_at")
			.eq("id", rec!.id)
			.single();
		// Advanced by ~1 month forward from the (past) trigger snapshot.
		expect(new Date(after!.next_occurrence_at).getTime()).toBeGreaterThan(Date.now());
	});

	it("catches up multiple missed occurrences in one call", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "catchup",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: shiftDays(todayInTZ(), -95), // ~3 months ago
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		// The BEFORE trigger sets next_at to the first FUTURE occurrence on
		// insert (no backfill), so for a 95-days-ago anchor we'd be stuck on
		// future. Manually push next_at backwards to simulate a row that has
		// been due for ~3 months without any cron run.
		const threeMonthsAgo = new Date();
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
		await admin
			.from("recurring")
			.update({ next_occurrence_at: threeMonthsAgo.toISOString() })
			.eq("id", rec!.id);

		const fired = await fireDue();
		expect(fired).toBeGreaterThanOrEqual(3);

		const { data: txs } = await admin
			.from("transaction")
			.select("date")
			.eq("recurring_id", rec!.id);
		expect(txs!.length).toBeGreaterThanOrEqual(3);
	});

	it("skips paused recurrings", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "paused",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: todayInTZ(),
				next_occurrence_at: new Date().toISOString(),
				is_paused: true,
			})
			.select("id, next_occurrence_at")
			.single();
		await setNextAtPast(rec!.id);

		const fired = await fireDue();
		expect(fired).toBe(0);

		const { count } = await admin
			.from("transaction")
			.select("id", { count: "exact", head: true })
			.eq("recurring_id", rec!.id);
		expect(count).toBe(0);
	});

	it("recomputes next_at when resumed", async () => {
		const pastAnchor = shiftDays(todayInTZ(), -10);
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "resume me",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: pastAnchor,
				next_occurrence_at: new Date().toISOString(),
				is_paused: true,
			})
			.select("id")
			.single();
		// Stale next_at while paused.
		const stale = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		await admin.from("recurring").update({ next_occurrence_at: stale }).eq("id", rec!.id);

		// Resume.
		await admin.from("recurring").update({ is_paused: false }).eq("id", rec!.id);

		const { data: after } = await admin
			.from("recurring")
			.select("next_occurrence_at")
			.eq("id", rec!.id)
			.single();
		expect(new Date(after!.next_occurrence_at).getTime()).toBeGreaterThan(Date.now() - 1000);
	});

	it("marks installment complete at remaining_occurrences = 0", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "installment",
				amount_centavos: 1_000_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: shiftDays(todayInTZ(), -65),
				next_occurrence_at: new Date().toISOString(),
				remaining_occurrences: 2,
			})
			.select("id")
			.single();
		// Push next_at well into the past so catchup loop fires both.
		await admin
			.from("recurring")
			.update({ next_occurrence_at: shiftDays(todayInTZ(), -65) + "T00:00:00+08:00" })
			.eq("id", rec!.id);

		await fireDue();

		const { data: after } = await admin
			.from("recurring")
			.select("is_completed, completed_at, remaining_occurrences")
			.eq("id", rec!.id)
			.single();
		expect(after!.is_completed).toBe(true);
		expect(after!.completed_at).not.toBeNull();
		expect(after!.remaining_occurrences).toBe(0);

		// Subsequent fires are no-ops.
		const fiscalSecond = await fireDue();
		expect(fiscalSecond).toBe(0);
	});

	it("editing amount does not reschedule", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "stable schedule",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: shiftDays(todayInTZ(), 7),
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id, next_occurrence_at")
			.single();
		const before = rec!.next_occurrence_at;

		await admin.from("recurring").update({ amount_centavos: 999_00 }).eq("id", rec!.id);

		const { data: after } = await admin
			.from("recurring")
			.select("next_occurrence_at")
			.eq("id", rec!.id)
			.single();
		expect(after!.next_occurrence_at).toBe(before);
	});

	it("editing interval reschedules", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "reschedule",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: shiftDays(todayInTZ(), -10),
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id, next_occurrence_at")
			.single();
		const before = rec!.next_occurrence_at;

		await admin.from("recurring").update({ interval: "weekly" }).eq("id", rec!.id);

		const { data: after } = await admin
			.from("recurring")
			.select("next_occurrence_at")
			.eq("id", rec!.id)
			.single();
		expect(after!.next_occurrence_at).not.toBe(before);
	});

	it("delete recurring keeps transactions but nulls FK", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "to be deleted",
				amount_centavos: 100_00,
				type: "expense",
				tag_id: foodsTagId,
				from_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: todayInTZ(),
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		await setNextAtPast(rec!.id);
		await fireDue();

		const { data: txBefore } = await admin
			.from("transaction")
			.select("id")
			.eq("recurring_id", rec!.id);
		const txId = txBefore![0].id;

		const { error } = await admin.from("recurring").delete().eq("id", rec!.id);
		expect(error).toBeNull();

		const { data: txAfter } = await admin
			.from("transaction")
			.select("id, recurring_id")
			.eq("id", txId)
			.single();
		expect(txAfter!.recurring_id).toBeNull();
	});

	it("transfer recurring with fee creates parent + paired child on fire", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "wallet → bank",
				amount_centavos: 5_000_00,
				type: "transfer",
				tag_id: null,
				from_account_id: walletId,
				to_account_id: cashId,
				fee_centavos: 25_00,
				interval: "monthly",
				first_occurrence_date: todayInTZ(),
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		await setNextAtPast(rec!.id);

		await fireDue();

		// Parent transfer.
		const { data: parents } = await admin
			.from("transaction")
			.select("id, type, fee_centavos")
			.eq("recurring_id", rec!.id);
		expect(parents!.length).toBe(1);
		expect(parents![0].type).toBe("transfer");
		expect(parents![0].fee_centavos).toBe(25_00);

		// Paired child (transfer-fees).
		const { data: child } = await admin
			.from("transaction")
			.select("type, amount_centavos, parent_transaction_id, recurring_id")
			.eq("parent_transaction_id", parents![0].id)
			.single();
		expect(child!.type).toBe("expense");
		expect(child!.amount_centavos).toBe(25_00);
		// The paired-fee sync trigger doesn't propagate recurring_id to the child.
		expect(child!.recurring_id).toBeNull();
	});

	it("supports recurring income (e.g., monthly salary)", async () => {
		const { data: rec } = await admin
			.from("recurring")
			.insert({
				user_id: userId,
				service: "GFED salary",
				amount_centavos: 50_000_00,
				type: "income",
				tag_id: salaryTagId,
				to_account_id: cashId,
				interval: "monthly",
				first_occurrence_date: todayInTZ(),
				next_occurrence_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		await setNextAtPast(rec!.id);

		const fired = await fireDue();
		expect(fired).toBe(1);

		const { data: txs } = await admin
			.from("transaction")
			.select("type, amount_centavos")
			.eq("recurring_id", rec!.id);
		expect(txs![0].type).toBe("income");
		expect(txs![0].amount_centavos).toBe(50_000_00);
	});
});
