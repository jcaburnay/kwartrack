import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.SUPABASE_SECRET_KEY;
const run = url?.startsWith("http://127.0.0.1:") && key ? describe : describe.skip;
let admin: SupabaseClient<Database>;
let signedIn: SupabaseClient<Database>;
let owner = "";
let foreignOwner = "";
let tagId = "";
let foreignTag = "";
const range = { start_date: "2031-11-15", end_date: "2031-12-15", overall_centavos: 10000 };
run("budget periods database", () => {
	beforeAll(async () => {
		admin = createClient<Database>(url, key, { auth: { persistSession: false } });
		const email = `period-${crypto.randomUUID()}@example.invalid`;
		const password = "test-period-password-123";
		const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
		if (created.error || !created.data.user) throw created.error;
		owner = created.data.user.id;
		const second = await admin.auth.admin.createUser({
			email: `other-${crypto.randomUUID()}@example.invalid`,
			password,
			email_confirm: true,
		});
		if (second.error || !second.data.user) throw second.error;
		foreignOwner = second.data.user.id;
		signedIn = createClient<Database>(url, import.meta.env.VITE_SUPABASE_ANON_KEY, {
			auth: { persistSession: false },
		});
		const login = await signedIn.auth.signInWithPassword({ email, password });
		if (login.error) throw login.error;
		const tags = await admin
			.from("tag")
			.select("id,user_id")
			.eq("name", "foods")
			.in("user_id", [owner, foreignOwner]);
		tagId = tags.data!.find((t) => t.user_id === owner)!.id;
		foreignTag = tags.data!.find((t) => t.user_id === foreignOwner)!.id;
	}, 30000);
	beforeEach(async () => {
		await admin.from("budget_allocation").delete().eq("user_id", owner);
		await admin.from("budget_config").delete().eq("user_id", owner);
		const wiped = await admin.from("budget_period").delete().eq("user_id", owner);
		if (wiped.error) throw wiped.error;
	});
	afterAll(async () => {
		if (owner) await admin.auth.admin.deleteUser(owner);
		if (foreignOwner) await admin.auth.admin.deleteUser(foreignOwner);
	});
	const create = async () => {
		const r = await signedIn
			.from("budget_period")
			.insert({ user_id: owner, ...range })
			.select()
			.single();
		if (r.error) throw r.error;
		return r.data;
	};
	it("accepts gaps and rejects shared boundary overlaps and reversed dates", async () => {
		await create();
		expect(
			(
				await signedIn
					.from("budget_period")
					.insert({ user_id: owner, ...range, start_date: "2031-12-15", end_date: "2032-01-15" })
			).error?.code,
		).toBe("23P01");
		expect(
			(
				await signedIn
					.from("budget_period")
					.insert({ user_id: owner, ...range, start_date: "2031-12-21", end_date: "2032-01-21" })
			).error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period")
					.insert({ user_id: owner, ...range, start_date: "2032-02-01", end_date: "2032-01-21" })
			).error,
		).not.toBeNull();
	});
	it("allows only one concurrent overlapping insert", async () => {
		const results = await Promise.all(
			[create(), create()].map((p) =>
				p.then(
					() => true,
					() => false,
				),
			),
		);
		expect(results.filter(Boolean)).toHaveLength(1);
	});
	it("enforces cap on allocations and reductions and copies atomically", async () => {
		const period = await create();
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.insert({ period_id: period.id, user_id: owner, tag_id: tagId, amount_centavos: 8000 })
			).error,
		).toBeNull();
		expect(
			(await signedIn.from("budget_period").update({ overall_centavos: 7000 }).eq("id", period.id))
				.error,
		).not.toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.update({ amount_centavos: 10001 })
					.eq("period_id", period.id)
			).error,
		).not.toBeNull();
		const target = await signedIn
			.from("budget_period")
			.insert({
				user_id: owner,
				start_date: "2031-12-21",
				end_date: "2032-01-21",
				overall_centavos: 0,
			})
			.select()
			.single();
		expect(target.error).toBeNull();
		expect(
			(await signedIn.rpc("copy_budget_period", { p_target: target.data!.id, p_source: period.id }))
				.error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period")
					.select("overall_centavos")
					.eq("id", target.data!.id)
					.single()
			).data?.overall_centavos,
		).toBe(10000);
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.select("amount_centavos")
					.eq("period_id", target.data!.id)
					.single()
			).data?.amount_centavos,
		).toBe(8000);
	});

	it("serializes concurrent allocations against the same cap", async () => {
		const p = await create();
		const tag = await admin
			.from("tag")
			.insert({ user_id: owner, name: "parallel-budget", type: "expense" })
			.select()
			.single();
		if (tag.error) throw tag.error;
		const results = await Promise.all(
			[tagId, tag.data.id].map((id) =>
				signedIn
					.from("budget_period_allocation")
					.insert({ user_id: owner, period_id: p.id, tag_id: id, amount_centavos: 6000 }),
			),
		);
		expect(results.filter((r) => !r.error)).toHaveLength(1);
		const rows = await signedIn
			.from("budget_period_allocation")
			.select("amount_centavos")
			.eq("period_id", p.id);
		expect(rows.data?.reduce((sum, a) => sum + a.amount_centavos, 0)).toBe(6000);
		await admin.from("tag").delete().eq("id", tag.data.id);
	});
	it("rejects copying when a target gained allocations after the UI loaded", async () => {
		const source = await create();
		const target = await signedIn
			.from("budget_period")
			.insert({
				user_id: owner,
				start_date: "2031-12-21",
				end_date: "2032-01-21",
				overall_centavos: 10000,
			})
			.select()
			.single();
		if (target.error) throw target.error;
		expect(
			(
				await signedIn.from("budget_period_allocation").insert({
					user_id: owner,
					period_id: target.data.id,
					tag_id: tagId,
					amount_centavos: 3000,
				})
			).error,
		).toBeNull();
		const result = await signedIn.rpc("copy_budget_period", {
			p_source: source.id,
			p_target: target.data.id,
		});
		expect(result.error?.message).toContain("already has allocations");
		const allocation = await signedIn
			.from("budget_period_allocation")
			.select("amount_centavos")
			.eq("period_id", target.data.id)
			.single();
		expect(allocation.data?.amount_centavos).toBe(3000);
	});
	it("reconciles legacy allocations when custom dates return to their original month", async () => {
		expect(
			(
				await signedIn
					.from("budget_config")
					.insert({ user_id: owner, month: "2031-08", overall_centavos: 10000 })
			).error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_allocation")
					.insert({ user_id: owner, month: "2031-08", tag_id: tagId, amount_centavos: 8000 })
			).error,
		).toBeNull();
		const p = await signedIn.from("budget_period").select().eq("legacy_month", "2031-08").single();
		if (p.error) throw p.error;
		expect(
			(await signedIn.from("budget_period").update({ end_date: "2031-09-15" }).eq("id", p.data.id))
				.error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.update({ amount_centavos: 3000 })
					.eq("period_id", p.data.id)
			).error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period")
					.update({ end_date: "2031-08-31", overall_centavos: 5000 })
					.eq("id", p.data.id)
			).error,
		).toBeNull();
		const legacy = await signedIn
			.from("budget_allocation")
			.select("amount_centavos")
			.eq("month", "2031-08")
			.single();
		expect(legacy.data?.amount_centavos).toBe(3000);
	});

	it("blocks foreign owners, foreign tags and foreign RPC targets", async () => {
		const p = await create();
		expect(
			(await signedIn.from("budget_period").insert({ user_id: foreignOwner, ...range })).error,
		).not.toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.insert({ period_id: p.id, user_id: owner, tag_id: foreignTag, amount_centavos: 10 })
			).error,
		).not.toBeNull();
		const other = await admin
			.from("budget_period")
			.insert({ user_id: foreignOwner, ...range })
			.select()
			.single();
		expect(other.error).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.insert({ period_id: other.data!.id, user_id: owner, tag_id: tagId, amount_centavos: 10 })
			).error,
		).not.toBeNull();
		expect(
			(await signedIn.rpc("copy_budget_period", { p_target: p.id, p_source: other.data!.id }))
				.error,
		).not.toBeNull();
		await admin.from("budget_period").delete().eq("id", other.data!.id);
	});
	it("mirrors legacy budgets and allocations without changing monthly values", async () => {
		expect(
			(
				await signedIn
					.from("budget_config")
					.insert({ user_id: owner, month: "2031-08", overall_centavos: 10000 })
			).error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_allocation")
					.insert({ user_id: owner, month: "2031-08", tag_id: tagId, amount_centavos: 3000 })
			).error,
		).toBeNull();
		const p = await signedIn.from("budget_period").select().eq("legacy_month", "2031-08").single();
		expect(p.data?.start_date).toBe("2031-08-01");
		expect(p.data?.end_date).toBe("2031-08-31");
		expect(
			(
				await signedIn
					.from("budget_period_allocation")
					.select("amount_centavos")
					.eq("period_id", p.data!.id)
					.single()
			).data?.amount_centavos,
		).toBe(3000);
		expect(
			(
				await signedIn
					.from("budget_period")
					.update({ overall_centavos: 12000 })
					.eq("id", p.data!.id)
			).error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_config")
					.select("overall_centavos")
					.eq("month", "2031-08")
					.single()
			).data?.overall_centavos,
		).toBe(12000);
		expect(
			(await signedIn.from("budget_period").update({ end_date: "2031-09-15" }).eq("id", p.data!.id))
				.error,
		).toBeNull();
		expect(
			(
				await signedIn
					.from("budget_config")
					.update({ overall_centavos: 14000 })
					.eq("month", "2031-08")
			).error?.message,
		).toContain("custom dates");
	});
	it("sums inclusive boundary expense dates without truncating to calendar months", async () => {
		const account = await admin
			.from("account")
			.insert({
				user_id: owner,
				name: "Period Test",
				type: "cash",
				balance_centavos: 10000,
				initial_balance_centavos: 10000,
			})
			.select()
			.single();
		if (account.error) throw account.error;
		const tx = await admin.from("transaction").insert(
			["2031-11-14", "2031-11-15", "2031-12-15", "2031-12-16"].map((date) => ({
				user_id: owner,
				type: "expense" as const,
				from_account_id: account.data.id,
				tag_id: tagId,
				amount_centavos: 100,
				date,
			})),
		);
		expect(tx.error).toBeNull();

		const person = await admin
			.from("person")
			.insert({ user_id: owner, name: "Budget Split" })
			.select()
			.single();
		if (person.error) throw person.error;
		const split = await signedIn.rpc("create_split", {
			p_description: "Boundary dinner",
			p_total_centavos: 1000,
			p_date: range.end_date,
			p_paid_from_account_id: account.data.id,
			p_tag_id: tagId,
			p_method: "exact",
			p_participants: [{ person_id: person.data.id, share_centavos: 600, share_input_value: 600 }],
		});
		expect(split.error).toBeNull();
		const actual = await signedIn.rpc("budget_range_actuals", {
			p_start: range.start_date,
			p_end: range.end_date,
		});
		expect(actual.error).toBeNull();
		expect(actual.data?.find((r) => r.tag_id === tagId)?.actual_centavos).toBe(600);
		await admin.from("split_event").delete().eq("user_id", owner);
		await admin.from("person").delete().eq("id", person.data.id);
		await admin.from("transaction").delete().eq("from_account_id", account.data.id);
		await admin.from("account").delete().eq("id", account.data.id);
	});
});
