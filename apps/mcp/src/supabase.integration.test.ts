import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseFinanceDataSource } from "./supabase.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY as string | undefined;
const canRun = Boolean(supabaseUrl && publishableKey && secretKey);
const runOrSkip = canRun ? describe : describe.skip;
const password = "mcp-integration-test-pw-1234";

let admin: ReturnType<typeof createClient>;
const userIds: string[] = [];
const accessTokens: string[] = [];

async function createTenant(label: string) {
	const email = `mcp-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`;
	const created = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { display_name: `MCP ${label}`, timezone: "Asia/Manila" },
	});
	if (created.error || !created.data.user) throw created.error ?? new Error("User was not created");
	userIds.push(created.data.user.id);

	const userClient = createClient(supabaseUrl!, publishableKey!, {
		auth: { persistSession: false },
	});
	const signedIn = await userClient.auth.signInWithPassword({ email, password });
	if (signedIn.error || !signedIn.data.session) {
		throw signedIn.error ?? new Error("User was not signed in");
	}
	accessTokens.push(signedIn.data.session.access_token);

	const inserted = await admin.from("account").insert({
		user_id: created.data.user.id,
		name: `${label} Wallet`,
		type: "cash",
		initial_balance_centavos: label === "First" ? 10_000 : 20_000,
	});
	if (inserted.error) throw inserted.error;
}

beforeAll(async () => {
	if (!canRun) return;
	admin = createClient(supabaseUrl!, secretKey!, { auth: { persistSession: false } });
	await createTenant("First");
	await createTenant("Second");
}, 30_000);

afterAll(async () => {
	if (!canRun) return;
	for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
});

runOrSkip("SupabaseFinanceDataSource RLS", () => {
	it("uses the caller's bearer token and cannot read another tenant", async () => {
		const first = new SupabaseFinanceDataSource(supabaseUrl!, publishableKey!, accessTokens[0]!);
		const second = new SupabaseFinanceDataSource(supabaseUrl!, publishableKey!, accessTokens[1]!);

		const [firstAccounts, secondAccounts] = await Promise.all([
			first.listAccounts({ includeArchived: true }),
			second.listAccounts({ includeArchived: true }),
		]);

		expect(firstAccounts.map((account) => account.name)).toEqual(["First Wallet"]);
		expect(secondAccounts.map((account) => account.name)).toEqual(["Second Wallet"]);
	});
});
