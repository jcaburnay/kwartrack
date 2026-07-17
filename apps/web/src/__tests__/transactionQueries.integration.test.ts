import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const canRun = Boolean(url && secretKey && publishableKey);
const runOrSkip = canRun ? describe : describe.skip;

const password = "integration-test-pw-1234";

let admin: SupabaseClient<Database>;
let user: SupabaseClient<Database>;
let userId = "";
let cashId = "";
let walletId = "";
let groupId = "";
let foodsTagId = "";
let salaryTagId = "";

async function createTenant() {
	const email = `tx-query+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: "Transaction Query Test", timezone: "Asia/Manila" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	user = createClient<Database>(url!, publishableKey!, { auth: { persistSession: false } });
	const signed = await user.auth.signInWithPassword({ email, password });
	if (signed.error) throw signed.error;

	const { data: tags, error: tagError } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	if (tagError || !tags) throw tagError ?? new Error("tags missing");
	foodsTagId = tags.find((t) => t.name === "foods" && t.type === "expense" && !t.is_system)!.id;
	salaryTagId = tags.find(
		(t) => t.name === "monthly-salary" && t.type === "income" && !t.is_system,
	)!.id;

	const { data: group, error: groupError } = await admin
		.from("account_group")
		.insert({ user_id: userId, name: "Bank" })
		.select("id")
		.single();
	if (groupError || !group) throw groupError ?? new Error("group not created");
	groupId = group.id;

	const { data: cash, error: cashError } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Cash",
			type: "cash",
			initial_balance_centavos: 100_000_00,
		})
		.select("id")
		.single();
	if (cashError || !cash) throw cashError ?? new Error("cash not created");
	cashId = cash.id;

	const { data: wallet, error: walletError } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "BPI Wallet",
			type: "e-wallet",
			initial_balance_centavos: 10_000_00,
			group_id: groupId,
		})
		.select("id")
		.single();
	if (walletError || !wallet) throw walletError ?? new Error("wallet not created");
	walletId = wallet.id;
}

async function seedTransactions() {
	const { error } = await user.from("transaction").insert([
		{
			user_id: userId,
			amount_centavos: 100_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: cashId,
			description: "SM Hypermarket",
			date: "2026-07-08",
		},
		{
			user_id: userId,
			amount_centavos: 1_000_00,
			type: "income",
			tag_id: salaryTagId,
			to_account_id: cashId,
			description: "Payroll",
			date: "2026-07-09",
		},
		{
			user_id: userId,
			amount_centavos: 200_00,
			type: "transfer",
			from_account_id: cashId,
			to_account_id: walletId,
			description: "Move to wallet",
			date: "2026-07-10",
		},
		{
			user_id: userId,
			amount_centavos: 300_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: cashId,
			description: "Shoes",
			date: "2026-07-11",
		},
		{
			user_id: userId,
			amount_centavos: 50_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: walletId,
			description: "June snack",
			date: "2026-06-30",
		},
	]);
	if (error) throw error;
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });
	await createTenant();
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	await user?.auth.signOut();
	if (userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await admin.from("transaction").delete().eq("user_id", userId);
	await seedTransactions();
});

runOrSkip("transaction_list()", () => {
	it("filters, searches, sorts, paginates, and returns the matching count", async () => {
		const firstPage = await user.rpc("transaction_list", {
			p_type: "expense",
			p_tag_id: foodsTagId,
			p_date_from: "2026-07-01",
			p_date_to: "2026-07-31",
			p_search: "",
			p_sort_key: "amount",
			p_sort_dir: "desc",
			p_limit: 1,
			p_offset: 0,
		});
		expect(firstPage.error).toBeNull();
		expect(firstPage.data).toHaveLength(1);
		expect(firstPage.data![0].description).toBe("Shoes");
		expect(firstPage.data![0].total_count).toBe(2);

		const secondPage = await user.rpc("transaction_list", {
			p_type: "expense",
			p_tag_id: foodsTagId,
			p_date_from: "2026-07-01",
			p_date_to: "2026-07-31",
			p_search: "",
			p_sort_key: "amount",
			p_sort_dir: "desc",
			p_limit: 1,
			p_offset: 1,
		});
		expect(secondPage.error).toBeNull();
		expect(secondPage.data).toHaveLength(1);
		expect(secondPage.data![0].description).toBe("SM Hypermarket");
		expect(secondPage.data![0].total_count).toBe(2);

		const searched = await user.rpc("transaction_list", {
			p_search: "hyper",
			p_sort_key: "date",
			p_sort_dir: "desc",
			p_limit: 20,
			p_offset: 0,
		});
		expect(searched.error).toBeNull();
		expect(searched.data?.map((tx) => tx.description)).toEqual(["SM Hypermarket"]);
	});

	it("matches group filters against either side of a transaction", async () => {
		const result = await user.rpc("transaction_list", {
			p_group_id: groupId,
			p_date_from: "2026-07-01",
			p_date_to: "2026-07-31",
			p_search: "",
			p_sort_key: "date",
			p_sort_dir: "asc",
			p_limit: 20,
			p_offset: 0,
		});

		expect(result.error).toBeNull();
		expect(result.data?.map((tx) => tx.description)).toEqual(["Move to wallet"]);
		expect(result.data?.[0].total_count).toBe(1);
	});
});

runOrSkip("transaction_month_summary()", () => {
	it("returns current-month net flow and selected-account inflow/outflow", async () => {
		const result = await user.rpc("transaction_month_summary", {
			p_date_from: "2026-07-01",
			p_date_to_exclusive: "2026-08-01",
			p_account_id: cashId,
		});

		expect(result.error).toBeNull();
		expect(result.data).toHaveLength(1);
		expect(result.data![0]).toMatchObject({
			net_inflow_centavos: 1_000_00,
			net_outflow_centavos: 400_00,
			net_centavos: 600_00,
			account_inflow_centavos: 1_000_00,
			account_outflow_centavos: 600_00,
		});
	});
});
