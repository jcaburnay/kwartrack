/**
 * Integration tests for budget_allocation cap-enforcement triggers and the
 * tag → allocation CASCADE relationship. Skipped when SUPABASE_SECRET_KEY is
 * absent.
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
let foodsTagId = "";
let petsTagId = "";
const month = "2026-04";
const otherMonth = "2026-05";

async function wipeBudget() {
	await admin.from("budget_allocation").delete().eq("user_id", userId);
	await admin.from("budget_config").delete().eq("user_id", userId);
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });

	const email = `budget+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password: "integration-test-pw-1234",
		email_confirm: true,
		user_metadata: { display_name: "Budget Test", timezone: "Asia/Manila" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	const { data: tags } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	foodsTagId = tags!.find((t) => t.name === "foods" && t.type === "expense" && !t.is_system)!.id;
	petsTagId = tags!.find((t) => t.name === "pets" && t.type === "expense" && !t.is_system)!.id;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	if (userId) await admin.auth.admin.deleteUser(userId);
});

beforeEach(async () => {
	if (!canRun) return;
	await wipeBudget();
});

runOrSkip("budget cap trigger", () => {
	it("rejects an allocation when no config row exists for that month", async () => {
		const { error } = await admin.from("budget_allocation").insert({
			user_id: userId,
			month: otherMonth,
			tag_id: foodsTagId,
			amount_centavos: 1_00,
		});
		expect(error).not.toBeNull();
	});

	it("allows Σ ≤ overall and rejects Σ > overall", async () => {
		await admin
			.from("budget_config")
			.upsert(
				{ user_id: userId, month, overall_centavos: 1_000_00 },
				{ onConflict: "user_id,month" },
			);
		const ok = await admin.from("budget_allocation").insert({
			user_id: userId,
			month,
			tag_id: foodsTagId,
			amount_centavos: 600_00,
		});
		expect(ok.error).toBeNull();
		const equal = await admin.from("budget_allocation").insert({
			user_id: userId,
			month,
			tag_id: petsTagId,
			amount_centavos: 400_00,
		});
		expect(equal.error).toBeNull();
		const over = await admin
			.from("budget_allocation")
			.update({ amount_centavos: 401_00 })
			.eq("user_id", userId)
			.eq("month", month)
			.eq("tag_id", petsTagId);
		expect(over.error).not.toBeNull();
	});

	it("rejects reducing overall below current Σ", async () => {
		await admin
			.from("budget_config")
			.upsert(
				{ user_id: userId, month, overall_centavos: 1_000_00 },
				{ onConflict: "user_id,month" },
			);
		await admin.from("budget_allocation").insert({
			user_id: userId,
			month,
			tag_id: foodsTagId,
			amount_centavos: 800_00,
		});
		const { error } = await admin
			.from("budget_config")
			.update({ overall_centavos: 500_00 })
			.eq("user_id", userId)
			.eq("month", month);
		expect(error).not.toBeNull();
	});
});

runOrSkip("tag delete CASCADE on allocation", () => {
	it("deletes a tag with an allocation (no transactions) — allocation cascades away", async () => {
		const { data: newTag } = await admin
			.from("tag")
			.insert({ user_id: userId, name: "ephemeral", type: "expense", is_system: false })
			.select("id")
			.single();
		await admin
			.from("budget_config")
			.upsert(
				{ user_id: userId, month, overall_centavos: 100_00 },
				{ onConflict: "user_id,month" },
			);
		await admin.from("budget_allocation").insert({
			user_id: userId,
			month,
			tag_id: newTag!.id,
			amount_centavos: 50_00,
		});
		const { error } = await admin.from("tag").delete().eq("id", newTag!.id);
		expect(error).toBeNull();
		const { count } = await admin
			.from("budget_allocation")
			.select("id", { count: "exact", head: true })
			.eq("tag_id", newTag!.id);
		expect(count).toBe(0);
	});
});
