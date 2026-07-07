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
let userA: SupabaseClient<Database>;
let userB: SupabaseClient<Database>;

let userAId = "";
let userBId = "";
let userACashId = "";
let userBCashId = "";
let userAGroupId = "";
let userBGroupId = "";
let userAFoodsTagId = "";
let userBFoodsTagId = "";
let userAPersonId = "";
let userBPersonId = "";

async function createTenant(label: string) {
	const email = `integrity-${label}+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: `Integrity ${label}` },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error(`user ${label}`);
	const userId = created.data.user.id;

	const client = createClient<Database>(url!, publishableKey!, { auth: { persistSession: false } });
	const signed = await client.auth.signInWithPassword({ email, password });
	if (signed.error) throw signed.error;

	const { data: tags, error: tagsError } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	if (tagsError || !tags) throw tagsError ?? new Error(`tags ${label}`);
	const foodsTagId = tags.find(
		(t) => t.name === "foods" && t.type === "expense" && !t.is_system,
	)!.id;

	const { data: group, error: groupError } = await admin
		.from("account_group")
		.insert({ user_id: userId, name: `Bank ${label}` })
		.select("id")
		.single();
	if (groupError || !group) throw groupError ?? new Error(`group ${label}`);

	const { data: cash, error: cashError } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: `Cash ${label}`,
			type: "cash",
			initial_balance_centavos: 100_000_00,
			group_id: group.id,
		})
		.select("id")
		.single();
	if (cashError || !cash) throw cashError ?? new Error(`cash ${label}`);

	const { data: person, error: personError } = await admin
		.from("person")
		.insert({ user_id: userId, name: `Person ${label}` })
		.select("id")
		.single();
	if (personError || !person) throw personError ?? new Error(`person ${label}`);

	return { client, userId, foodsTagId, groupId: group.id, cashId: cash.id, personId: person.id };
}

async function balanceOf(accountId: string): Promise<number> {
	const { data, error } = await admin
		.from("account")
		.select("balance_centavos")
		.eq("id", accountId)
		.single();
	if (error || !data) throw error ?? new Error("account not found");
	return data.balance_centavos;
}

async function expectOwnerMismatch(error: { message: string } | null) {
	expect(error).not.toBeNull();
	expect(error!.message).toMatch(/same user|owned by this user|ledger/i);
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });
	const a = await createTenant("a");
	const b = await createTenant("b");

	userA = a.client;
	userB = b.client;
	userAId = a.userId;
	userBId = b.userId;
	userACashId = a.cashId;
	userBCashId = b.cashId;
	userAGroupId = a.groupId;
	userBGroupId = b.groupId;
	userAFoodsTagId = a.foodsTagId;
	userBFoodsTagId = b.foodsTagId;
	userAPersonId = a.personId;
	userBPersonId = b.personId;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	await userA?.auth.signOut();
	await userB?.auth.signOut();
	if (userAId) await admin.auth.admin.deleteUser(userAId);
	if (userBId) await admin.auth.admin.deleteUser(userBId);
});

beforeEach(async () => {
	if (!canRun) return;
	await admin.from("transaction").delete().in("user_id", [userAId, userBId]);
	await admin.from("budget_allocation").delete().in("user_id", [userAId, userBId]);
	await admin.from("recurring").delete().in("user_id", [userAId, userBId]);
	await admin.from("split_event").delete().in("user_id", [userAId, userBId]);
	await admin.from("debt").delete().in("user_id", [userAId, userBId]);
	await admin.from("account").update({ group_id: userAGroupId }).eq("id", userACashId);
	await admin.from("account").update({ group_id: userBGroupId }).eq("id", userBCashId);
});

runOrSkip("tenant-boundary data integrity", () => {
	it("rejects direct account balance updates outside ledger triggers", async () => {
		const before = await balanceOf(userACashId);
		const { error } = await userA
			.from("account")
			.update({ balance_centavos: before + 1_00 })
			.eq("id", userACashId);

		await expectOwnerMismatch(error);
		expect(await balanceOf(userACashId)).toBe(before);
	});

	it("rejects transactions that reference another user's account", async () => {
		const { error } = await userA.from("transaction").insert({
			user_id: userAId,
			amount_centavos: 1_000_00,
			type: "expense",
			tag_id: userAFoodsTagId,
			from_account_id: userBCashId,
			date: "2026-07-08",
		});

		await expectOwnerMismatch(error);
		expect(await balanceOf(userBCashId)).toBe(100_000_00);
	});

	it("rejects transactions that reference another user's tag", async () => {
		const { error } = await userA.from("transaction").insert({
			user_id: userAId,
			amount_centavos: 1_000_00,
			type: "expense",
			tag_id: userBFoodsTagId,
			from_account_id: userACashId,
			date: "2026-07-08",
		});

		await expectOwnerMismatch(error);
	});

	it("rejects account group assignment across users", async () => {
		const { error } = await userA
			.from("account")
			.update({ group_id: userBGroupId })
			.eq("id", userACashId);

		await expectOwnerMismatch(error);
	});

	it("rejects recurring rows that reference another user's account", async () => {
		const { error } = await userA.from("recurring").insert({
			user_id: userAId,
			service: "Bad recurring",
			amount_centavos: 1_000_00,
			type: "expense",
			tag_id: userAFoodsTagId,
			from_account_id: userBCashId,
			interval: "monthly",
			first_occurrence_date: "2026-07-08",
			next_occurrence_at: new Date().toISOString(),
		});

		await expectOwnerMismatch(error);
	});

	it("rejects budget allocations that reference another user's tag", async () => {
		await userA
			.from("budget_config")
			.upsert(
				{ user_id: userAId, month: "2026-07", overall_centavos: 10_000_00 },
				{ onConflict: "user_id,month" },
			);
		const { error } = await userA.from("budget_allocation").insert({
			user_id: userAId,
			month: "2026-07",
			tag_id: userBFoodsTagId,
			amount_centavos: 1_000_00,
		});

		await expectOwnerMismatch(error);
	});

	it("rejects standalone debts that reference another user's person", async () => {
		const { error } = await userA.from("debt").insert({
			user_id: userAId,
			person_id: userBPersonId,
			direction: "loaned",
			amount_centavos: 1_000_00,
			paid_account_id: userACashId,
			tag_id: userAFoodsTagId,
			date: "2026-07-08",
			description: "bad debt",
		});

		await expectOwnerMismatch(error);
	});

	it("rejects split RPC participants from another user", async () => {
		const { error } = await userA.rpc("create_split", {
			p_description: "bad split",
			p_total_centavos: 3_000_00,
			p_date: "2026-07-08",
			p_paid_from_account_id: userACashId,
			p_tag_id: userAFoodsTagId,
			p_method: "equal",
			p_participants: [
				{
					person_id: userBPersonId,
					share_centavos: 1_500_00,
					share_input_value: null,
				},
			],
		});

		await expectOwnerMismatch(error);
	});

	it("still allows valid same-user ledger transactions to update balances", async () => {
		const { error } = await userA.from("transaction").insert({
			user_id: userAId,
			amount_centavos: 1_000_00,
			type: "expense",
			tag_id: userAFoodsTagId,
			from_account_id: userACashId,
			date: "2026-07-08",
		});

		expect(error).toBeNull();
		expect(await balanceOf(userACashId)).toBe(99_000_00);
	});

	it("still allows valid same-user standalone debts", async () => {
		const { error } = await userA.from("debt").insert({
			user_id: userAId,
			person_id: userAPersonId,
			direction: "loaned",
			amount_centavos: 1_000_00,
			paid_account_id: userACashId,
			tag_id: userAFoodsTagId,
			date: "2026-07-08",
			description: "valid debt",
		});

		expect(error).toBeNull();
	});
});
