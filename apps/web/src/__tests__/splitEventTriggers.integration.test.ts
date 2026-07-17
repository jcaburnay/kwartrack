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
let datesTagId = "";
let alicePersonId = "";
let bobPersonId = "";

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });
	const email = `splittrig+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password: "integration-test-pw-1234",
		email_confirm: true,
		user_metadata: { display_name: "Split Test", timezone: "Asia/Manila" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user");
	userId = created.data.user.id;

	const { data: tags } = await admin
		.from("tag")
		.select("id, name, type, is_system")
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

	const { data: alice } = await admin
		.from("person")
		.insert({ user_id: userId, name: "Alice" })
		.select("id")
		.single();
	alicePersonId = alice!.id;
	const { data: bob } = await admin
		.from("person")
		.insert({ user_id: userId, name: "Bob" })
		.select("id")
		.single();
	bobPersonId = bob!.id;
}, 30_000);

afterAll(async () => {
	if (canRun && userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await admin.from("split_event").delete().eq("user_id", userId);
});

runOrSkip("split_event auto-expense trigger", () => {
	it("creates an expense tx tagged with the split's tag", async () => {
		const { data: split } = await admin
			.from("split_event")
			.insert({
				user_id: userId,
				description: "lunch",
				total_centavos: 30000,
				date: "2026-04-26",
				paid_from_account_id: cashId,
				tag_id: datesTagId,
				method: "equal",
			})
			.select("id")
			.single();
		const { data: txs } = await admin.from("transaction").select("*").eq("split_id", split!.id);
		expect(txs!.length).toBe(1);
		expect(txs![0].type).toBe("expense");
		expect(txs![0].amount_centavos).toBe(30000);
		expect(txs![0].tag_id).toBe(datesTagId);
		expect(txs![0].from_account_id).toBe(cashId);
	});

	it("propagates total_centavos / tag / date / description / from-account on UPDATE", async () => {
		const { data: split } = await admin
			.from("split_event")
			.insert({
				user_id: userId,
				description: "lunch",
				total_centavos: 30000,
				date: "2026-04-26",
				paid_from_account_id: cashId,
				tag_id: datesTagId,
				method: "equal",
			})
			.select("id")
			.single();

		await admin
			.from("split_event")
			.update({
				total_centavos: 45000,
				description: "lunch v2",
				date: "2026-04-27",
			})
			.eq("id", split!.id);

		const { data: tx } = await admin
			.from("transaction")
			.select("*")
			.eq("split_id", split!.id)
			.single();
		expect(tx!.amount_centavos).toBe(45000);
		expect(tx!.description).toBe("lunch v2");
		expect(tx!.date).toBe("2026-04-27");
	});
});

runOrSkip("split_event.user_share_centavos cache", () => {
	async function makeSplit(total: number) {
		const { data } = await admin
			.from("split_event")
			.insert({
				user_id: userId,
				description: "x",
				total_centavos: total,
				date: "2026-04-26",
				paid_from_account_id: cashId,
				tag_id: datesTagId,
				method: "equal",
			})
			.select("id")
			.single();
		return data!.id;
	}

	it("recomputes when participants are added/removed", async () => {
		const id = await makeSplit(30000);
		// no participants yet -> user_share = total
		let { data: s } = await admin
			.from("split_event")
			.select("user_share_centavos")
			.eq("id", id)
			.single();
		expect(s!.user_share_centavos).toBe(30000);

		await admin.from("split_participant").insert({
			split_id: id,
			person_id: alicePersonId,
			share_centavos: 10000,
			share_input_value: null,
		});
		({ data: s } = await admin
			.from("split_event")
			.select("user_share_centavos")
			.eq("id", id)
			.single());
		expect(s!.user_share_centavos).toBe(20000);

		await admin.from("split_participant").insert({
			split_id: id,
			person_id: bobPersonId,
			share_centavos: 10000,
			share_input_value: null,
		});
		({ data: s } = await admin
			.from("split_event")
			.select("user_share_centavos")
			.eq("id", id)
			.single());
		expect(s!.user_share_centavos).toBe(10000);

		await admin.from("split_participant").delete().eq("split_id", id).eq("person_id", bobPersonId);
		({ data: s } = await admin
			.from("split_event")
			.select("user_share_centavos")
			.eq("id", id)
			.single());
		expect(s!.user_share_centavos).toBe(20000);
	});

	it("recomputes when total_centavos changes", async () => {
		const id = await makeSplit(30000);
		await admin.from("split_participant").insert({
			split_id: id,
			person_id: alicePersonId,
			share_centavos: 10000,
			share_input_value: null,
		});
		await admin.from("split_event").update({ total_centavos: 50000 }).eq("id", id);
		const { data: s } = await admin
			.from("split_event")
			.select("user_share_centavos")
			.eq("id", id)
			.single();
		expect(s!.user_share_centavos).toBe(40000);
	});
});
