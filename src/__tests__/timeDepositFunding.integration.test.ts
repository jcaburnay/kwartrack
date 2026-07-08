import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const canRun = Boolean(url && secretKey && publishableKey);
const runOrSkip = canRun ? describe : describe.skip;

const password = "integration-test-pw-1234";
const TZ = "Asia/Manila";

let admin: SupabaseClient<Database>;
let user: SupabaseClient<Database>;
let userId = "";
let savingsId = "";

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

async function accountBalance(accountId: string): Promise<number> {
	const { data, error } = await admin
		.from("account")
		.select("balance_centavos")
		.eq("id", accountId)
		.single();
	if (error || !data) throw error ?? new Error("account missing");
	return data.balance_centavos;
}

async function createSavingsAccount() {
	const { data, error } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "BPI Savings",
			type: "savings",
			initial_balance_centavos: 100_000_00,
		})
		.select("id")
		.single();
	if (error || !data) throw error ?? new Error("savings not created");
	savingsId = data.id;
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });

	const email = `td-funding+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: "TD Funding Test", timezone: TZ },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	user = createClient<Database>(url!, publishableKey!, { auth: { persistSession: false } });
	const signed = await user.auth.signInWithPassword({ email, password });
	if (signed.error) throw signed.error;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	await user?.auth.signOut();
	if (userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await admin.from("transaction").delete().eq("user_id", userId);
	await admin
		.from("account")
		.update({ interest_recurring_id: null })
		.eq("user_id", userId)
		.not("interest_recurring_id", "is", null);
	await admin.from("recurring").delete().eq("user_id", userId);
	await admin.from("account").delete().eq("user_id", userId);
	await createSavingsAccount();
});

runOrSkip("create_time_deposit()", () => {
	it("creates an externally funded time deposit with the existing opening-balance behavior", async () => {
		const { data: tdId, error } = await user.rpc("create_time_deposit", {
			p_name: "External TD",
			p_principal_centavos: 50_000_00,
			p_interest_rate_bps: 600,
			p_maturity_date: shiftDays(todayInTZ(), 180),
			p_interest_posting_interval: "monthly",
		});

		expect(error).toBeNull();
		expect(tdId).toEqual(expect.any(String));

		const { data: td } = await admin.from("account").select("*").eq("id", tdId!).single();
		expect(td).toMatchObject({
			type: "time-deposit",
			initial_balance_centavos: 50_000_00,
			principal_centavos: 50_000_00,
			balance_centavos: 50_000_00,
		});
		expect(await accountBalance(savingsId)).toBe(100_000_00);
	});

	it("funds a new time deposit from an existing savings account atomically", async () => {
		const { data: tdId, error } = await user.rpc("create_time_deposit", {
			p_name: "Funded TD",
			p_principal_centavos: 50_000_00,
			p_interest_rate_bps: 600,
			p_maturity_date: shiftDays(todayInTZ(), 180),
			p_interest_posting_interval: "monthly",
			p_funding_account_id: savingsId,
			p_funding_date: "2026-07-08",
		});

		expect(error).toBeNull();
		expect(tdId).toEqual(expect.any(String));

		const { data: td } = await admin.from("account").select("*").eq("id", tdId!).single();
		expect(td).toMatchObject({
			type: "time-deposit",
			initial_balance_centavos: 0,
			principal_centavos: 50_000_00,
			balance_centavos: 50_000_00,
		});
		expect(td!.interest_recurring_id).not.toBeNull();
		expect(await accountBalance(savingsId)).toBe(50_000_00);

		const { data: txs } = await admin
			.from("transaction")
			.select("*")
			.eq("user_id", userId)
			.eq("from_account_id", savingsId)
			.eq("to_account_id", tdId!);
		expect(txs).toHaveLength(1);
		expect(txs![0]).toMatchObject({
			type: "transfer",
			amount_centavos: 50_000_00,
			date: "2026-07-08",
			description: "Fund Funded TD",
		});
	});

	it("rejects funding from an account without enough available balance", async () => {
		const { error } = await user.rpc("create_time_deposit", {
			p_name: "Too Big TD",
			p_principal_centavos: 150_000_00,
			p_interest_rate_bps: 600,
			p_maturity_date: shiftDays(todayInTZ(), 180),
			p_interest_posting_interval: "monthly",
			p_funding_account_id: savingsId,
		});

		expect(error).not.toBeNull();
		expect(error!.message).toMatch(/insufficient balance/i);
		expect(await accountBalance(savingsId)).toBe(100_000_00);

		const { data: accounts } = await admin
			.from("account")
			.select("id")
			.eq("user_id", userId)
			.eq("name", "Too Big TD");
		expect(accounts ?? []).toHaveLength(0);
	});
});
