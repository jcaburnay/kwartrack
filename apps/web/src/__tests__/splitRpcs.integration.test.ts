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
let mayaId = "";
let datesTagId = "";
let alice = "";
let bob = "";
let carol = "";

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });
	user = createClient<Database>(url!, publishableKey!, { auth: { persistSession: false } });
	const email = `splitrpc+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: "Split RPC Test" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user");
	userId = created.data.user.id;
	const signed = await user.auth.signInWithPassword({ email, password });
	if (signed.error) throw signed.error;

	const { data: tags } = await admin
		.from("tag")
		.select("id, name, is_system")
		.eq("user_id", userId);
	datesTagId = tags!.find((t) => t.name === "dates" && !t.is_system)!.id;
	const { data: cash } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Cash",
			type: "cash",
			initial_balance_centavos: 1_000_000_00,
		})
		.select("id")
		.single();
	cashId = cash!.id;
	const { data: maya } = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Maya",
			type: "e-wallet",
			initial_balance_centavos: 1_000_000_00,
		})
		.select("id")
		.single();
	mayaId = maya!.id;
	const { data: aRow } = await admin
		.from("person")
		.insert({ user_id: userId, name: "Alice" })
		.select("id")
		.single();
	alice = aRow!.id;
	const { data: bRow } = await admin
		.from("person")
		.insert({ user_id: userId, name: "Bob" })
		.select("id")
		.single();
	bob = bRow!.id;
	const { data: cRow } = await admin
		.from("person")
		.insert({ user_id: userId, name: "Carol" })
		.select("id")
		.single();
	carol = cRow!.id;
}, 30_000);

afterAll(async () => {
	if (canRun && userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await admin.from("debt").delete().eq("user_id", userId);
	await admin.from("split_event").delete().eq("user_id", userId);
	await admin.from("transaction").delete().eq("user_id", userId).is("parent_transaction_id", null);
});

async function createEqualSplit(total: number, persons: string[]) {
	// equal: payer (user) absorbs remainder; participants get base share.
	const base = Math.floor(total / (persons.length + 1));
	const participants = persons.map((p) => ({
		person_id: p,
		share_centavos: base,
		share_input_value: null,
	}));
	const { data, error } = await user.rpc("create_split", {
		p_description: "lunch",
		p_total_centavos: total,
		p_date: "2026-04-26",
		p_paid_from_account_id: mayaId,
		p_tag_id: datesTagId,
		p_method: "equal",
		p_participants: participants,
	});
	if (error) throw error;
	return data as string;
}

runOrSkip("create_split", () => {
	it("inserts split_event + N participants + N debts + auto-expense", async () => {
		const id = await createEqualSplit(48000, [alice, bob, carol]);
		const { data: split } = await admin.from("split_event").select("*").eq("id", id).single();
		expect(split!.user_share_centavos).toBe(48000 - 12000 * 3);
		const { count: pCount } = await admin
			.from("split_participant")
			.select("id", { count: "exact", head: true })
			.eq("split_id", id);
		expect(pCount).toBe(3);
		const { count: dCount } = await admin
			.from("debt")
			.select("id", { count: "exact", head: true })
			.eq("split_id", id);
		expect(dCount).toBe(3);
		const { data: tx } = await admin.from("transaction").select("*").eq("split_id", id).single();
		expect(tx!.amount_centavos).toBe(48000);
	});
});

runOrSkip("update_split", () => {
	it("preserves settlement progress when only share is unchanged", async () => {
		const id = await createEqualSplit(30000, [alice, bob]);
		const { data: aliceDebt } = await admin
			.from("debt")
			.select("id, amount_centavos")
			.eq("split_id", id)
			.eq("person_id", alice)
			.single();
		await user.rpc("settle_debt", {
			p_debt_id: aliceDebt!.id,
			p_amount_centavos: 5000,
			p_paid_account_id: cashId,
		});

		// Edit description; same shares.
		const { error: updErr } = await user.rpc("update_split", {
			p_split_id: id,
			p_description: "lunch v2",
			p_total_centavos: 30000,
			p_date: "2026-04-26",
			p_paid_from_account_id: mayaId,
			p_tag_id: datesTagId,
			p_method: "equal",
			p_participants: [
				{ person_id: alice, share_centavos: 10000, share_input_value: null },
				{ person_id: bob, share_centavos: 10000, share_input_value: null },
			],
		});
		expect(updErr).toBeNull();

		const { data: refreshed } = await admin
			.from("debt")
			.select("settled_centavos")
			.eq("id", aliceDebt!.id)
			.single();
		expect(refreshed!.settled_centavos).toBe(5000);
	});

	it("rejects lowering a participant's share below their settled_centavos", async () => {
		const id = await createEqualSplit(30000, [alice, bob]);
		const { data: aliceDebt } = await admin
			.from("debt")
			.select("id")
			.eq("split_id", id)
			.eq("person_id", alice)
			.single();
		await user.rpc("settle_debt", {
			p_debt_id: aliceDebt!.id,
			p_amount_centavos: 8000,
			p_paid_account_id: cashId,
		});
		const { error } = await user.rpc("update_split", {
			p_split_id: id,
			p_description: "x",
			p_total_centavos: 12000,
			p_date: "2026-04-26",
			p_paid_from_account_id: mayaId,
			p_tag_id: datesTagId,
			p_method: "exact",
			p_participants: [
				{ person_id: alice, share_centavos: 5000, share_input_value: 5000 },
				{ person_id: bob, share_centavos: 5000, share_input_value: 5000 },
			],
		});
		expect(error).not.toBeNull();
		expect(String(error!.message)).toMatch(/settled_le_amount|check/i);
	});
});

runOrSkip("settle_debt", () => {
	it("inserts an income tx for a loaned debt; updates settled_centavos", async () => {
		const id = await createEqualSplit(30000, [alice, bob]);
		const { data: aliceDebt } = await admin
			.from("debt")
			.select("id, amount_centavos")
			.eq("split_id", id)
			.eq("person_id", alice)
			.single();
		const { error } = await user.rpc("settle_debt", {
			p_debt_id: aliceDebt!.id,
			p_amount_centavos: 5000,
			p_paid_account_id: cashId,
		});
		expect(error).toBeNull();
		const { data: tx } = await admin
			.from("transaction")
			.select("type, to_account_id")
			.eq("debt_id", aliceDebt!.id)
			.single();
		expect(tx!.type).toBe("income");
		expect(tx!.to_account_id).toBe(cashId);
		const { data: refreshed } = await admin
			.from("debt")
			.select("settled_centavos")
			.eq("id", aliceDebt!.id)
			.single();
		expect(refreshed!.settled_centavos).toBe(5000);
	});

	it("rejects over-settling", async () => {
		const id = await createEqualSplit(30000, [alice, bob]);
		const { data: aliceDebt } = await admin
			.from("debt")
			.select("id, amount_centavos")
			.eq("split_id", id)
			.eq("person_id", alice)
			.single();
		const { error } = await user.rpc("settle_debt", {
			p_debt_id: aliceDebt!.id,
			p_amount_centavos: aliceDebt!.amount_centavos + 1,
			p_paid_account_id: cashId,
		});
		expect(error).not.toBeNull();
	});
});

runOrSkip("budget actuals: split-linked expense uses user_share", () => {
	it("auto-expense joined with split_event reports user_share_centavos via column", async () => {
		const id = await createEqualSplit(30000, [alice, bob]);
		const { data: tx } = await admin
			.from("transaction")
			.select("amount_centavos, split_id, split:split_event!split_id(user_share_centavos)")
			.eq("split_id", id)
			.single();
		expect(tx!.amount_centavos).toBe(30000);
		expect((tx!.split as unknown as { user_share_centavos: number }).user_share_centavos).toBe(
			10000,
		);
	});
});
