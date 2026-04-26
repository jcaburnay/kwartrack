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
let foodsTagId = "";
let datesTagId = "";
let settlementTagId = "";
let orphanTagId = "";
let alicePersonId = "";

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });
	user = createClient<Database>(url!, publishableKey!, { auth: { persistSession: false } });
	const email = `debttrig+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: "Debt Test", timezone: "Asia/Manila" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user");
	userId = created.data.user.id;
	const signed = await user.auth.signInWithPassword({ email, password });
	if (signed.error) throw signed.error;

	const { data: tags } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	foodsTagId = tags!.find((t) => t.name === "foods" && !t.is_system)!.id;
	datesTagId = tags!.find((t) => t.name === "dates" && !t.is_system)!.id;
	settlementTagId = tags!.find((t) => t.name === "debt-settlement" && t.is_system)!.id;
	orphanTagId = tags!.find((t) => t.name === "debt-settlement-orphan" && t.is_system)!.id;

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
	const { data: alice } = await admin
		.from("person")
		.insert({ user_id: userId, name: "Alice" })
		.select("id")
		.single();
	alicePersonId = alice!.id;
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

runOrSkip("debt creation-tx trigger", () => {
	it("creates an expense tx for a standalone loaned debt with paid-from", async () => {
		const { data: d } = await admin
			.from("debt")
			.insert({
				user_id: userId,
				person_id: alicePersonId,
				direction: "loaned",
				amount_centavos: 50000,
				date: "2026-04-26",
				paid_account_id: mayaId,
				tag_id: foodsTagId,
			})
			.select("id")
			.single();
		const { data: txs } = await admin.from("transaction").select("*").eq("debt_id", d!.id);
		expect(txs!.length).toBe(1);
		expect(txs![0].type).toBe("expense");
		expect(txs![0].from_account_id).toBe(mayaId);
		expect(txs![0].tag_id).toBe(foodsTagId);
	});

	it("does not create a tx when paid_account_id is null (data-only IOU)", async () => {
		const { data: d } = await admin
			.from("debt")
			.insert({
				user_id: userId,
				person_id: alicePersonId,
				direction: "loaned",
				amount_centavos: 50000,
				date: "2026-04-26",
			})
			.select("id")
			.single();
		const { data: txs } = await admin.from("transaction").select("*").eq("debt_id", d!.id);
		expect(txs!.length).toBe(0);
	});

	it("creates an income tx for a standalone owed debt with paid-from", async () => {
		const { data: d } = await admin
			.from("debt")
			.insert({
				user_id: userId,
				person_id: alicePersonId,
				direction: "owed",
				amount_centavos: 30000,
				date: "2026-04-26",
				paid_account_id: mayaId,
				tag_id: foodsTagId,
			})
			.select("id")
			.single();
		const { data: txs } = await admin.from("transaction").select("*").eq("debt_id", d!.id);
		expect(txs![0].type).toBe("income");
		expect(txs![0].to_account_id).toBe(mayaId);
	});
});

runOrSkip("transaction_before_delete_guard", () => {
	it("blocks direct delete when split_id or debt_id is set", async () => {
		const { data: d } = await admin
			.from("debt")
			.insert({
				user_id: userId,
				person_id: alicePersonId,
				direction: "loaned",
				amount_centavos: 50000,
				date: "2026-04-26",
				paid_account_id: mayaId,
				tag_id: foodsTagId,
			})
			.select("id")
			.single();
		const { data: tx } = await admin.from("transaction").select("id").eq("debt_id", d!.id).single();
		const { error } = await admin.from("transaction").delete().eq("id", tx!.id);
		expect(error).not.toBeNull();
		expect(String(error!.message)).toMatch(/tied to a split\/debt/i);
	});

	it("allows delete of plain transactions (no split_id / debt_id)", async () => {
		const { data: tx } = await admin
			.from("transaction")
			.insert({
				user_id: userId,
				type: "expense",
				from_account_id: cashId,
				tag_id: foodsTagId,
				amount_centavos: 10000,
				date: "2026-04-26",
			})
			.select("id")
			.single();
		const { error } = await admin.from("transaction").delete().eq("id", tx!.id);
		expect(error).toBeNull();
	});
});

runOrSkip("debt_before_delete orphan-retag", () => {
	it("preserves settlement-tagged tx, retags to debt-settlement-orphan", async () => {
		const { data: d } = await admin
			.from("debt")
			.insert({
				user_id: userId,
				person_id: alicePersonId,
				direction: "loaned",
				amount_centavos: 50000,
				date: "2026-04-26",
			})
			.select("id")
			.single();
		// Simulate a settlement tx by calling settle_debt RPC.
		const { error: rpcErr } = await user.rpc("settle_debt", {
			p_debt_id: d!.id,
			p_amount_centavos: 20000,
			p_paid_account_id: cashId,
		});
		expect(rpcErr).toBeNull();
		const { data: settleTx } = await admin
			.from("transaction")
			.select("id, tag_id")
			.eq("debt_id", d!.id)
			.single();
		expect(settleTx!.tag_id).toBe(settlementTagId);

		// Delete the debt directly.
		await admin.from("debt").delete().eq("id", d!.id);

		const { data: after } = await admin
			.from("transaction")
			.select("debt_id, tag_id")
			.eq("id", settleTx!.id)
			.single();
		expect(after!.debt_id).toBeNull();
		expect(after!.tag_id).toBe(orphanTagId);
	});

	it("deletes the standalone-debt creation tx (its tag != debt-settlement)", async () => {
		const { data: d } = await admin
			.from("debt")
			.insert({
				user_id: userId,
				person_id: alicePersonId,
				direction: "loaned",
				amount_centavos: 50000,
				date: "2026-04-26",
				paid_account_id: mayaId,
				tag_id: foodsTagId,
			})
			.select("id")
			.single();
		const { data: createTx } = await admin
			.from("transaction")
			.select("id")
			.eq("debt_id", d!.id)
			.single();

		await admin.from("debt").delete().eq("id", d!.id);

		const { data: after } = await admin.from("transaction").select("id").eq("id", createTx!.id);
		expect(after!.length).toBe(0);
	});
});

runOrSkip("split_event delete cascade", () => {
	it("deletes auto-expense, orphan-retags settlement transactions on linked debts", async () => {
		const splitId = await user
			.rpc("create_split", {
				p_description: "lunch",
				p_total_centavos: 30000,
				p_date: "2026-04-26",
				p_paid_from_account_id: mayaId,
				p_tag_id: datesTagId,
				p_method: "equal",
				p_participants: [
					{
						person_id: alicePersonId,
						share_centavos: 15000,
						share_input_value: null,
					},
				],
			})
			.then((r) => {
				if (r.error) throw r.error;
				return r.data as string;
			});

		const { data: debt } = await admin.from("debt").select("id").eq("split_id", splitId).single();
		await user.rpc("settle_debt", {
			p_debt_id: debt!.id,
			p_amount_centavos: 5000,
			p_paid_account_id: cashId,
		});
		const { data: settleTx } = await admin
			.from("transaction")
			.select("id")
			.eq("debt_id", debt!.id)
			.single();

		// Delete the split.
		const { error: delErr } = await admin.from("split_event").delete().eq("id", splitId);
		expect(delErr).toBeNull();

		// Auto-expense gone.
		const { count: autoCount } = await admin
			.from("transaction")
			.select("id", { count: "exact", head: true })
			.eq("split_id", splitId);
		expect(autoCount).toBe(0);

		// Settlement tx preserved + retagged.
		const { data: after } = await admin
			.from("transaction")
			.select("debt_id, tag_id")
			.eq("id", settleTx!.id)
			.single();
		expect(after!.debt_id).toBeNull();
		expect(after!.tag_id).toBe(orphanTagId);
	});
});

runOrSkip("person FK RESTRICT", () => {
	it("blocks delete when a debt references the person", async () => {
		const { data: bob } = await admin
			.from("person")
			.insert({ user_id: userId, name: "Bob" })
			.select("id")
			.single();
		await admin.from("debt").insert({
			user_id: userId,
			person_id: bob!.id,
			direction: "loaned",
			amount_centavos: 10000,
			date: "2026-04-26",
		});
		const { error } = await admin.from("person").delete().eq("id", bob!.id);
		expect(error).not.toBeNull();
	});
});
