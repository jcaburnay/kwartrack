/**
 * Integration test: useMonthlySpendTrend issues one query that:
 *   - filters to type='expense'
 *   - includes paired transfer-fees children (no parent_transaction_id IS NULL)
 *   - reads split user_share_centavos via the join
 * and bucketSpendByMonth shapes the result into 12 buckets oldest → newest.
 *
 * Skipped when SUPABASE_SECRET_KEY is absent (matches Slice 5 / 9 patterns).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useMonthlySpendTrend } from "../hooks/useMonthlySpendTrend";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const canRun = Boolean(url && secretKey && publishableKey);
const runOrSkip = canRun ? describe : describe.skip;

let admin: SupabaseClient<Database>;
let userId = "";

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient<Database>(url!, secretKey!, { auth: { persistSession: false } });
	const email = `overview+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@example.invalid`;
	const password = "integration-test-pw-1234";
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: "Overview Test", timezone: "Asia/Manila" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
	userId = created.data.user.id;

	// Two cash accounts (simple; no credit math interference).
	const wallet = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Wallet",
			type: "cash",
			initial_balance_centavos: 100_000_00,
			balance_centavos: 100_000_00,
		})
		.select()
		.single();
	const savings = await admin
		.from("account")
		.insert({
			user_id: userId,
			name: "Savings",
			type: "savings",
			initial_balance_centavos: 100_000_00,
			balance_centavos: 100_000_00,
		})
		.select()
		.single();

	// One foods tag (already seeded by handle_new_user).
	const tagsRes = await admin.from("tag").select("id, name").eq("user_id", userId);
	const foods = tagsRes.data!.find((t) => t.name === "foods")!;

	// Three plain expenses across 3 months.
	await admin.from("transaction").insert([
		{
			user_id: userId,
			type: "expense",
			amount_centavos: 100_00,
			tag_id: foods.id,
			from_account_id: wallet.data!.id,
			date: "2026-04-01",
		},
		{
			user_id: userId,
			type: "expense",
			amount_centavos: 200_00,
			tag_id: foods.id,
			from_account_id: wallet.data!.id,
			date: "2026-03-01",
		},
		{
			user_id: userId,
			type: "expense",
			amount_centavos: 300_00,
			tag_id: foods.id,
			from_account_id: wallet.data!.id,
			date: "2026-02-01",
		},
	]);

	// One transfer with a non-zero fee → paired transfer-fees child should be included.
	await admin.from("transaction").insert({
		user_id: userId,
		type: "transfer",
		amount_centavos: 1000_00,
		from_account_id: wallet.data!.id,
		to_account_id: savings.data!.id,
		fee_centavos: 50_00,
		date: "2026-04-05",
	});

	// One split — only user's share should count. Total ₱4800, 3 friends each ₱960,
	// user's share = ₱4800 - 3*960 = ₱1920. We must use a publishable-key client
	// signed in as this user to invoke the create_split RPC (it relies on auth.uid()).
	// Three distinct persons required — split_participant has a unique constraint on (split_id, person_id).
	const [p1Res, p2Res, p3Res] = await Promise.all([
		admin.from("person").insert({ user_id: userId, name: "Friend1" }).select().single(),
		admin.from("person").insert({ user_id: userId, name: "Friend2" }).select().single(),
		admin.from("person").insert({ user_id: userId, name: "Friend3" }).select().single(),
	]);
	const datesTag = tagsRes.data!.find((t) => t.name === "dates")!;

	const userClient = createClient<Database>(url!, publishableKey!);
	await userClient.auth.signInWithPassword({ email, password });
	const { error: splitErr } = await userClient.rpc("create_split", {
		p_description: "Group dinner",
		p_total_centavos: 4_800_00,
		p_date: "2026-04-10",
		p_paid_from_account_id: wallet.data!.id,
		p_tag_id: datesTag.id,
		p_method: "equal",
		p_participants: [
			{ person_id: p1Res.data!.id, share_centavos: 960_00, share_input_value: null },
			{ person_id: p2Res.data!.id, share_centavos: 960_00, share_input_value: null },
			{ person_id: p3Res.data!.id, share_centavos: 960_00, share_input_value: null },
		],
	});
	if (splitErr) throw splitErr;
	await userClient.auth.signOut();

	// Sign the app's singleton client into this test user so the hook's RLS reads the right rows.
	const { supabase: appClient } = await import("../lib/supabase");
	await appClient.auth.signInWithPassword({ email, password });
}, 60_000);

afterAll(async () => {
	if (!canRun) return;
	const { supabase: appClient } = await import("../lib/supabase");
	await appClient.auth.signOut();
	await admin.auth.admin.deleteUser(userId);
});

runOrSkip("useMonthlySpendTrend (integration)", () => {
	it("returns 12 buckets oldest → newest with split-share + transfer-fee math", async () => {
		const today = new Date("2026-04-15T08:00:00Z");
		const { result } = renderHook(() => useMonthlySpendTrend(today, "Asia/Manila"));
		await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5_000 });
		expect(result.current.error).toBeNull();
		expect(result.current.trend).toHaveLength(12);
		expect(result.current.trend[0].monthISO).toBe("2025-05");
		expect(result.current.trend[11].monthISO).toBe("2026-04");

		const apr = result.current.trend.find((b) => b.monthISO === "2026-04")!;
		// April expenses:
		//   ₱100 plain
		//   ₱50  paired transfer-fee (child of the transfer)
		//   ₱1920 user share of the split
		expect(apr.totalCentavos).toBe(100_00 + 50_00 + 1920_00);

		const mar = result.current.trend.find((b) => b.monthISO === "2026-03")!;
		expect(mar.totalCentavos).toBe(200_00);

		const feb = result.current.trend.find((b) => b.monthISO === "2026-02")!;
		expect(feb.totalCentavos).toBe(300_00);
	}, 30_000);
});
