/**
 * Integration tests for tag management operations:
 *   1. rename — updates name; 23505 on duplicate name+type collision
 *   2. delete — succeeds when tag has no transactions
 *   3. delete — blocked (FK 23503) when a transaction references the tag
 *
 * Runs against the local Supabase stack via service role.
 * Skipped when SUPABASE_SECRET_KEY is not available.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const canRun = Boolean(url && secretKey);
const runOrSkip = canRun ? describe : describe.skip;

let admin: SupabaseClient<Database>;
let userId = "";
let foodsTagId = "";
let cashAccountId = "";

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });

	const tenantEmail = `tags+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email: tenantEmail,
		password: "integration-test-pw-1234",
		email_confirm: true,
		user_metadata: { display_name: "Tag Test" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	const { data: tags, error: tagErr } = await admin
		.from("tag")
		.select("id, name, type, is_system")
		.eq("user_id", userId);
	if (tagErr || !tags) throw tagErr ?? new Error("tags missing");

	const foods = tags.find((t) => t.name === "foods" && t.type === "expense" && !t.is_system);
	if (!foods) throw new Error("seeded 'foods' tag not found");
	foodsTagId = foods.id;

	const { data: cashRow, error: cashErr } = await admin
		.from("account")
		.insert({ user_id: userId, name: "Cash", type: "cash", initial_balance_centavos: 10_000_00 })
		.select("id")
		.single();
	if (cashErr || !cashRow) throw cashErr ?? new Error("cash account not created");
	cashAccountId = cashRow.id;
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	if (userId) await admin.auth.admin.deleteUser(userId);
});

runOrSkip("tag rename", () => {
	it("renames a user tag by id", async () => {
		const { error } = await admin
			.from("tag")
			.update({ name: "foods-renamed" })
			.eq("id", foodsTagId);
		expect(error).toBeNull();

		const { data } = await admin.from("tag").select("name").eq("id", foodsTagId).single();
		expect(data?.name).toBe("foods-renamed");

		// Restore for subsequent tests
		await admin.from("tag").update({ name: "foods" }).eq("id", foodsTagId);
	});

	it("returns unique violation (23505) when renaming to an existing name+type", async () => {
		// 'grocery' already exists as expense — renaming 'foods' to 'grocery' collides
		const { error } = await admin.from("tag").update({ name: "grocery" }).eq("id", foodsTagId);
		expect(error).not.toBeNull();
		expect(error!.code).toBe("23505");
	});
});

runOrSkip("tag delete", () => {
	it("deletes a tag with no transactions", async () => {
		const { data: newTag, error: createErr } = await admin
			.from("tag")
			.insert({ user_id: userId, name: "disposable-tag", type: "expense", is_system: false })
			.select("id")
			.single();
		if (createErr || !newTag) throw createErr ?? new Error("tag not created");

		const { error } = await admin.from("tag").delete().eq("id", newTag.id);
		expect(error).toBeNull();
	});

	it("fails with FK violation (23503) when a transaction references the tag", async () => {
		const { error: txErr } = await admin.from("transaction").insert({
			user_id: userId,
			amount_centavos: 100_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: cashAccountId,
			date: "2026-04-24",
		});
		expect(txErr).toBeNull();

		const { error: delErr } = await admin.from("tag").delete().eq("id", foodsTagId);
		expect(delErr).not.toBeNull();
		expect(delErr!.code).toBe("23503");

		// Cleanup transaction so afterAll user-deletion doesn't conflict
		await admin.from("transaction").delete().eq("user_id", userId).eq("tag_id", foodsTagId);
	});

	it("fails with FK violation (23503) when a recurring references the tag", async () => {
		const { error: recErr } = await admin.from("recurring").insert({
			user_id: userId,
			service: "Spotify",
			amount_centavos: 279_00,
			type: "expense",
			tag_id: foodsTagId,
			from_account_id: cashAccountId,
			interval: "monthly",
			first_occurrence_date: "2026-04-24",
			next_occurrence_at: "2026-04-23T16:00:00Z",
		});
		expect(recErr).toBeNull();

		const { error: delErr } = await admin.from("tag").delete().eq("id", foodsTagId);
		expect(delErr).not.toBeNull();
		expect(delErr!.code).toBe("23503");

		// Deleting the recurring then the tag succeeds.
		await admin.from("recurring").delete().eq("user_id", userId).eq("tag_id", foodsTagId);
	});
});
