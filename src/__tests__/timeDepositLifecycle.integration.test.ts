/**
 * Integration tests for Slice 8 (Time deposits) DB-level mechanics:
 *   - On TD account INSERT, td_account_after_insert creates the linked
 *     recurring (or skips when interval = 'at-maturity').
 *   - On TD account UPDATE, td_account_after_update keeps amount/interval/
 *     name in sync, and creates/deletes the recurring on at-maturity ↔
 *     periodic transitions.
 *   - td_check_maturity_due() flips is_matured and either pauses the linked
 *     recurring (periodic) or posts the lump-sum income (at-maturity).
 *   - account delete is blocked by recurring.to_account_id ON DELETE
 *     RESTRICT when an active recurring exists.
 *
 * Skipped without SUPABASE_SECRET_KEY (mirrors recurringTriggers pattern).
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
let interestTagId = "";

const TZ = "Asia/Manila";

function shiftDays(isoDate: string, deltaDays: number): string {
	const d = new Date(`${isoDate}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + deltaDays);
	return d.toISOString().slice(0, 10);
}

function todayInTZ(): string {
	const fmt = new Intl.DateTimeFormat("en-CA", {
		timeZone: TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return fmt.format(new Date());
}

async function createTd(over: {
	name: string;
	principal_centavos?: number;
	interest_rate_bps?: number;
	maturity_date?: string;
	interest_posting_interval?: Database["public"]["Enums"]["posting_interval"];
}) {
	const principal = over.principal_centavos ?? 100_000_00;
	const { data, error } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: over.name,
			type: "time-deposit",
			initial_balance_centavos: principal,
			principal_centavos: principal,
			interest_rate_bps: over.interest_rate_bps ?? 600,
			maturity_date: over.maturity_date ?? shiftDays(todayInTZ(), 365),
			interest_posting_interval: over.interest_posting_interval ?? "monthly",
		})
		.select("id")
		.single();
	if (error) throw error;
	// Re-read so we see the AFTER INSERT trigger's interest_recurring_id update
	// (Postgres INSERT ... RETURNING reflects pre-AFTER-trigger state).
	return reload(data.id);
}

async function reload(accountId: string) {
	const { data, error } = await admin.from("account").select("*").eq("id", accountId).single();
	if (error) throw error;
	return data;
}

async function getRecurring(id: string) {
	const { data, error } = await admin.from("recurring").select("*").eq("id", id).single();
	if (error) throw error;
	return data;
}

async function wipeAccountsAndRelated() {
	await admin.from("transaction").delete().eq("user_id", userId);
	// Null the FK so recurrings can be deleted, then null the back-FK.
	await admin
		.from("account")
		.update({ interest_recurring_id: null })
		.eq("user_id", userId)
		.not("interest_recurring_id", "is", null);
	await admin.from("recurring").delete().eq("user_id", userId);
	await admin.from("account").delete().eq("user_id", userId);
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });

	const email = `td+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password: "integration-test-pw-1234",
		email_confirm: true,
		user_metadata: { display_name: "TD Test", timezone: TZ },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	const { data: tags } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	interestTagId = tags!.find(
		(t) => t.name === "interest-earned" && t.type === "income" && !t.is_system,
	)!.id;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	if (userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await wipeAccountsAndRelated();
});

runOrSkip("td_account_after_insert trigger", () => {
	it("creates a linked recurring with v1-parity amount for monthly TDs", async () => {
		const td = await createTd({ name: "Monthly TD" });
		expect(td.interest_recurring_id).not.toBeNull();
		const rec = await getRecurring(td.interest_recurring_id!);
		// v1 parity: ₱100,000 × 6% / 12 × 0.80 = ₱400.00
		expect(rec.amount_centavos).toBe(400_00);
		expect(rec.type).toBe("income");
		expect(rec.interval).toBe("monthly");
		expect(rec.tag_id).toBe(interestTagId);
		expect(rec.to_account_id).toBe(td.id);
		expect(rec.from_account_id).toBeNull();
		expect(rec.service).toBe("Monthly TD — Interest");
	});

	it("uses the right divisor for quarterly", async () => {
		const td = await createTd({ name: "Q TD", interest_posting_interval: "quarterly" });
		const rec = await getRecurring(td.interest_recurring_id!);
		// 100,000 × 6% / 4 × 0.80 = ₱1,200.00
		expect(rec.amount_centavos).toBe(1_200_00);
		expect(rec.interval).toBe("quarterly");
	});

	it("maps semi-annual and annual cleanly", async () => {
		const semi = await createTd({ name: "S TD", interest_posting_interval: "semi-annual" });
		const ann = await createTd({ name: "A TD", interest_posting_interval: "annual" });
		const semiRec = await getRecurring(semi.interest_recurring_id!);
		const annRec = await getRecurring(ann.interest_recurring_id!);
		expect(semiRec.interval).toBe("semi_annual");
		expect(semiRec.amount_centavos).toBe(2_400_00); // 100k × 0.06 / 2 × 0.8
		expect(annRec.interval).toBe("annual");
		expect(annRec.amount_centavos).toBe(4_800_00); // 100k × 0.06 / 1 × 0.8
	});

	it("does NOT create a recurring for at-maturity TDs", async () => {
		const td = await createTd({ name: "Lump TD", interest_posting_interval: "at-maturity" });
		expect(td.interest_recurring_id).toBeNull();
		const { data } = await admin
			.from("recurring")
			.select("id")
			.eq("user_id", userId)
			.eq("to_account_id", td.id);
		expect(data ?? []).toHaveLength(0);
	});
});

runOrSkip("td_account_after_update trigger", () => {
	it("recomputes amount when rate_bps changes", async () => {
		const td = await createTd({ name: "RateChange TD" });
		await admin.from("account").update({ interest_rate_bps: 750 }).eq("id", td.id);
		const rec = await getRecurring(td.interest_recurring_id!);
		// 100,000 × 7.5% / 12 × 0.80 = ₱500.00
		expect(rec.amount_centavos).toBe(500_00);
	});

	it("retunes amount + interval on periodic→periodic transition", async () => {
		const td = await createTd({ name: "PeriodChange TD" });
		await admin.from("account").update({ interest_posting_interval: "quarterly" }).eq("id", td.id);
		const rec = await getRecurring(td.interest_recurring_id!);
		expect(rec.interval).toBe("quarterly");
		expect(rec.amount_centavos).toBe(1_200_00);
	});

	it("deletes the recurring + nulls FK on transition to at-maturity", async () => {
		const td = await createTd({ name: "ToLump TD" });
		const oldRecId = td.interest_recurring_id!;
		await admin
			.from("account")
			.update({ interest_posting_interval: "at-maturity" })
			.eq("id", td.id);
		const reloaded = await reload(td.id);
		expect(reloaded.interest_recurring_id).toBeNull();
		const { data } = await admin.from("recurring").select("id").eq("id", oldRecId);
		expect(data ?? []).toHaveLength(0);
	});

	it("creates a fresh recurring when transitioning at-maturity → periodic", async () => {
		const td = await createTd({ name: "FromLump TD", interest_posting_interval: "at-maturity" });
		expect(td.interest_recurring_id).toBeNull();
		await admin.from("account").update({ interest_posting_interval: "monthly" }).eq("id", td.id);
		const reloaded = await reload(td.id);
		expect(reloaded.interest_recurring_id).not.toBeNull();
		const rec = await getRecurring(reloaded.interest_recurring_id!);
		expect(rec.interval).toBe("monthly");
		expect(rec.amount_centavos).toBe(400_00);
	});

	it("syncs the recurring's service label on account name change", async () => {
		const td = await createTd({ name: "Old Name TD" });
		await admin.from("account").update({ name: "New Name TD" }).eq("id", td.id);
		const rec = await getRecurring(td.interest_recurring_id!);
		expect(rec.service).toBe("New Name TD — Interest");
	});
});

runOrSkip("td_check_maturity_due()", () => {
	it("flips is_matured + deletes recurring for a periodic TD past maturity", async () => {
		const td = await createTd({ name: "Past TD", maturity_date: shiftDays(todayInTZ(), -1) });
		const recId = td.interest_recurring_id!;
		const { data: count, error } = await admin.rpc("td_check_maturity_due");
		expect(error).toBeNull();
		expect(count).toBeGreaterThanOrEqual(1);
		const reloaded = await reload(td.id);
		expect(reloaded.is_matured).toBe(true);
		// FK SET NULL clears interest_recurring_id once the recurring is gone.
		expect(reloaded.interest_recurring_id).toBeNull();
		const { data: rec } = await admin.from("recurring").select("id").eq("id", recId);
		expect(rec ?? []).toHaveLength(0);
	});

	it("matured TDs can now be hard-deleted through the normal path", async () => {
		const td = await createTd({ name: "Cleanup TD", maturity_date: shiftDays(todayInTZ(), -1) });
		await admin.rpc("td_check_maturity_due");
		const { error } = await admin.from("account").delete().eq("id", td.id);
		expect(error).toBeNull();
	});

	it("posts a single lump-sum income for at-maturity TD past maturity", async () => {
		// Created 1 year ago, maturity yesterday — interest = 100k × 6% × ~365/365 × 0.8 ≈ ₱4,800
		const yearAgo = shiftDays(todayInTZ(), -365);
		const td = await createTd({
			name: "Lump TD",
			interest_posting_interval: "at-maturity",
			maturity_date: shiftDays(todayInTZ(), -1),
		});
		// Backdate created_at via admin update (created_at is normally not editable by RLS).
		await admin
			.from("account")
			.update({ created_at: `${yearAgo}T00:00:00Z` })
			.eq("id", td.id);

		await admin.rpc("td_check_maturity_due");
		const reloaded = await reload(td.id);
		expect(reloaded.is_matured).toBe(true);

		const { data: txs } = await admin
			.from("transaction")
			.select("*")
			.eq("user_id", userId)
			.eq("to_account_id", td.id);
		expect(txs).toHaveLength(1);
		expect(txs![0].type).toBe("income");
		expect(txs![0].tag_id).toBe(interestTagId);
		// 100k × 6% × 364/365 × 0.8 ≈ ₱4,786.84 (loose bounds for date-arithmetic skew)
		expect(txs![0].amount_centavos).toBeGreaterThan(4_700_00);
		expect(txs![0].amount_centavos).toBeLessThan(4_900_00);
		expect(txs![0].description).toBe("At-maturity interest");
	});

	it("leaves future-maturity TDs alone", async () => {
		const td = await createTd({ name: "Future TD", maturity_date: shiftDays(todayInTZ(), 30) });
		await admin.rpc("td_check_maturity_due");
		const reloaded = await reload(td.id);
		expect(reloaded.is_matured).toBe(false);
	});
});

runOrSkip("delete enforcement", () => {
	it("blocks deletion of an active TD via recurring.to_account_id RESTRICT", async () => {
		// Realistic UI state: account.interest_recurring_id still points at the
		// recurring; recurring.to_account_id still points at the account.
		// Account-side FK is SET NULL (would clear), but recurring-side is
		// RESTRICT and that's what fires.
		const td = await createTd({ name: "Active TD" });
		const { error } = await admin.from("account").delete().eq("id", td.id);
		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/foreign key|recurring|violates/i);
	});
});
