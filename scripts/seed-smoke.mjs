// Seed the local Supabase with the `smoke@kwartrack.test` user and a realistic
// fixture: 2 groups, 7 accounts (covering all 5 types), 3 hand-rolled
// recurrings (subscription, auto-savings transfer, installment), and ~20
// transactions over the past 30 days. Idempotent — deletes the user first
// then re-creates everything.
//
// Run: `node scripts/seed-smoke.mjs`
// Requires VITE_SUPABASE_URL + SUPABASE_SECRET_KEY in .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
	const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
	for (const line of raw.split("\n")) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const eq = t.indexOf("=");
		if (eq === -1) continue;
		const k = t.slice(0, eq).trim();
		const v = t.slice(eq + 1).trim();
		if (!process.env[k]) process.env[k] = v;
	}
}
loadEnvLocal();

const url = process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY");

const admin = createClient(url, secret, { auth: { persistSession: false } });

const EMAIL = "smoke@kwartrack.test";
const PASSWORD = "smoketest1234";
const TZ = "Asia/Manila";

function shiftDays(deltaDays) {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + deltaDays);
	return d.toISOString().slice(0, 10);
}

async function findExistingUser() {
	let page = 1;
	while (true) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
		if (error) throw error;
		const found = data.users.find((u) => u.email === EMAIL);
		if (found) return found;
		if (data.users.length < 100) return null;
		page += 1;
	}
}

async function wipeUserData(userId) {
	// Delete in dependency order. transaction.recurring_id ON DELETE SET NULL,
	// account.interest_recurring_id ON DELETE SET NULL — so transactions and
	// accounts survive a recurring delete. Clear them anyway to start clean.
	await admin.from("transaction").delete().eq("user_id", userId);
	// Null both back-FKs so recurring/account deletes don't RESTRICT.
	await admin
		.from("account")
		.update({ interest_recurring_id: null })
		.eq("user_id", userId)
		.not("interest_recurring_id", "is", null);
	await admin.from("recurring").delete().eq("user_id", userId);
	await admin.from("budget_allocation").delete().eq("user_id", userId);
	await admin.from("account").delete().eq("user_id", userId);
	await admin.from("account_group").delete().eq("user_id", userId);
}

async function fetchTags(userId) {
	const { data, error } = await admin.from("tag").select("id, name, type").eq("user_id", userId);
	if (error) throw error;
	const map = new Map();
	for (const t of data) map.set(`${t.type}:${t.name}`, t.id);
	return map;
}

async function insertAll(table, rows, label) {
	if (rows.length === 0) return;
	const { error } = await admin.from(table).insert(rows);
	if (error) throw new Error(`${label} insert failed: ${error.message}`);
	console.log(`inserted ${rows.length} ${label}`);
}

async function main() {
	// Reuse the user if it exists (auth.admin.deleteUser sometimes leaves a
	// soft-delete tombstone that blocks re-create), otherwise create fresh.
	let userId;
	const existing = await findExistingUser();
	if (existing) {
		userId = existing.id;
		await wipeUserData(userId);
		console.log(`reused user ${userId} (wiped data)`);
	} else {
		const { data: created, error: createErr } = await admin.auth.admin.createUser({
			email: EMAIL,
			password: PASSWORD,
			email_confirm: true,
			user_metadata: { display_name: "Smoke Tester", timezone: TZ },
		});
		if (createErr) throw createErr;
		userId = created.user.id;
		console.log(`created user ${userId}`);
	}

	// Groups.
	const { data: groups, error: gErr } = await admin
		.from("account_group")
		.insert([
			{ user_id: userId, name: "BPI" },
			{ user_id: userId, name: "Maya" },
		])
		.select("id, name");
	if (gErr) throw gErr;
	const groupId = (n) => groups.find((g) => g.name === n).id;

	// Accounts. Initial balances are starting points; transactions below mutate
	// from here. The TD AFTER INSERT trigger auto-creates the linked interest
	// recurring for periodic TDs.
	const accountSpecs = [
		{ name: "Cash", type: "cash", initial_balance_centavos: 6_000_00, group_id: null },
		{
			name: "Maya Wallet",
			type: "e-wallet",
			initial_balance_centavos: 30_000_00,
			group_id: groupId("Maya"),
		},
		{
			name: "Maya Savings",
			type: "savings",
			initial_balance_centavos: 50_000_00,
			group_id: groupId("Maya"),
		},
		{
			name: "BPI Savings",
			type: "savings",
			initial_balance_centavos: 250_000_00,
			group_id: groupId("BPI"),
		},
		{
			name: "BPI Credit",
			type: "credit",
			initial_balance_centavos: 5_000_00,
			credit_limit_centavos: 80_000_00,
			installment_limit_centavos: 60_000_00,
			group_id: groupId("BPI"),
		},
		{
			name: "BPI Time Deposit",
			type: "time-deposit",
			initial_balance_centavos: 100_000_00,
			principal_centavos: 100_000_00,
			interest_rate_bps: 600,
			maturity_date: shiftDays(365),
			interest_posting_interval: "monthly",
			group_id: groupId("BPI"),
		},
		{
			name: "BPI 1Y Bond",
			type: "time-deposit",
			initial_balance_centavos: 50_000_00,
			principal_centavos: 50_000_00,
			interest_rate_bps: 750,
			maturity_date: shiftDays(180),
			interest_posting_interval: "at-maturity",
			group_id: groupId("BPI"),
		},
	];
	const { data: accounts, error: aErr } = await admin
		.from("account")
		.insert(accountSpecs.map((a) => ({ user_id: userId, ...a })))
		.select("id, name");
	if (aErr) throw aErr;
	const acctId = (n) => accounts.find((a) => a.name === n).id;
	console.log(`inserted ${accounts.length} accounts`);

	const tags = await fetchTags(userId);
	const tagId = (type, name) => {
		const id = tags.get(`${type}:${name}`);
		if (!id) throw new Error(`tag not found: ${type}:${name}`);
		return id;
	};

	// Hand-rolled recurrings (the TD-Interest one is auto-created by the trigger).
	// next_occurrence_at is materialized by the BEFORE trigger; the value we
	// pass is overwritten.
	const placeholderTs = new Date().toISOString();
	const recurrings = [
		{
			user_id: userId,
			service: "Spotify Family",
			amount_centavos: 299_00,
			type: "expense",
			tag_id: tagId("expense", "digital-subscriptions"),
			from_account_id: acctId("Maya Wallet"),
			interval: "monthly",
			first_occurrence_date: shiftDays(7),
			next_occurrence_at: placeholderTs,
		},
		{
			user_id: userId,
			service: "Auto-savings BPI→Maya",
			amount_centavos: 5_000_00,
			type: "transfer",
			from_account_id: acctId("BPI Savings"),
			to_account_id: acctId("Maya Savings"),
			fee_centavos: 25_00,
			interval: "monthly",
			first_occurrence_date: shiftDays(14),
			next_occurrence_at: placeholderTs,
		},
		{
			user_id: userId,
			service: "iPhone installment",
			amount_centavos: 2_999_00,
			type: "expense",
			tag_id: tagId("expense", "gadgets"),
			from_account_id: acctId("BPI Credit"),
			interval: "monthly",
			first_occurrence_date: shiftDays(15),
			next_occurrence_at: placeholderTs,
			remaining_occurrences: 12,
		},
	];
	await insertAll("recurring", recurrings, "recurrings");

	// Transactions over the past 30 days. Mix of expense/income/transfer across
	// all account types.
	const transactions = [
		// Income.
		{
			amount_centavos: 50_000_00,
			type: "income",
			tag_id: tagId("income", "monthly-salary"),
			to_account_id: acctId("BPI Savings"),
			description: "April salary",
			date: shiftDays(-25),
		},
		{
			amount_centavos: 2_000_00,
			type: "income",
			tag_id: tagId("income", "gifts"),
			to_account_id: acctId("Cash"),
			description: "Birthday cash",
			date: shiftDays(-10),
		},
		// Transfers.
		{
			amount_centavos: 15_000_00,
			type: "transfer",
			from_account_id: acctId("BPI Savings"),
			to_account_id: acctId("Maya Wallet"),
			fee_centavos: 25_00,
			description: "Top up Maya",
			date: shiftDays(-24),
		},
		{
			amount_centavos: 6_979_00,
			type: "transfer",
			from_account_id: acctId("BPI Savings"),
			to_account_id: acctId("BPI Credit"),
			description: "Pay BPI card",
			date: shiftDays(-3),
		},
		// Cash spend.
		{
			amount_centavos: 280_00,
			type: "expense",
			tag_id: tagId("expense", "foods"),
			from_account_id: acctId("Cash"),
			description: "Lunch w/ team",
			date: shiftDays(-23),
		},
		{
			amount_centavos: 195_00,
			type: "expense",
			tag_id: tagId("expense", "personal-care"),
			from_account_id: acctId("Cash"),
			description: "Haircut",
			date: shiftDays(-12),
		},
		{
			amount_centavos: 320_00,
			type: "expense",
			tag_id: tagId("expense", "transportation"),
			from_account_id: acctId("Cash"),
			description: "Taxi",
			date: shiftDays(-8),
		},
		{
			amount_centavos: 420_00,
			type: "expense",
			tag_id: tagId("expense", "foods"),
			from_account_id: acctId("Cash"),
			date: shiftDays(-11),
		},
		// Maya Wallet spend.
		{
			amount_centavos: 1_250_00,
			type: "expense",
			tag_id: tagId("expense", "foods"),
			from_account_id: acctId("Maya Wallet"),
			description: "Sunday brunch",
			date: shiftDays(-18),
		},
		{
			amount_centavos: 220_00,
			type: "expense",
			tag_id: tagId("expense", "transportation"),
			from_account_id: acctId("Maya Wallet"),
			description: "Grab",
			date: shiftDays(-22),
		},
		{
			amount_centavos: 850_00,
			type: "expense",
			tag_id: tagId("expense", "health"),
			from_account_id: acctId("Maya Wallet"),
			description: "Vitamins",
			date: shiftDays(-1),
		},
		{
			amount_centavos: 379_00,
			type: "expense",
			tag_id: tagId("expense", "digital-subscriptions"),
			from_account_id: acctId("Maya Wallet"),
			description: "YouTube Premium",
			date: shiftDays(-8),
		},
		{
			amount_centavos: 720_00,
			type: "expense",
			tag_id: tagId("expense", "foods"),
			from_account_id: acctId("Maya Wallet"),
			description: "Dinner",
			date: shiftDays(-4),
		},
		{
			amount_centavos: 180_00,
			type: "expense",
			tag_id: tagId("expense", "transportation"),
			from_account_id: acctId("Maya Wallet"),
			date: shiftDays(-15),
		},
		// BPI Credit spend.
		{
			amount_centavos: 4_999_00,
			type: "expense",
			tag_id: tagId("expense", "online-shopping"),
			from_account_id: acctId("BPI Credit"),
			description: "Lazada",
			date: shiftDays(-14),
		},
		{
			amount_centavos: 3_450_00,
			type: "expense",
			tag_id: tagId("expense", "grocery"),
			from_account_id: acctId("BPI Credit"),
			description: "S&R run",
			date: shiftDays(-20),
		},
		{
			amount_centavos: 1_980_00,
			type: "expense",
			tag_id: tagId("expense", "grocery"),
			from_account_id: acctId("BPI Credit"),
			date: shiftDays(-6),
		},
		// BPI Savings spend (bills paid from main account).
		{
			amount_centavos: 2_400_00,
			type: "expense",
			tag_id: tagId("expense", "bills"),
			from_account_id: acctId("BPI Savings"),
			description: "Electric",
			date: shiftDays(-16),
		},
		{
			amount_centavos: 1_650_00,
			type: "expense",
			tag_id: tagId("expense", "bills"),
			from_account_id: acctId("BPI Savings"),
			description: "Internet",
			date: shiftDays(-21),
		},
	];
	await insertAll(
		"transaction",
		transactions.map((t) => ({ user_id: userId, ...t })),
		"transactions",
	);

	// Budget for the current month. The signup trigger already inserted a
	// budget_config row with overall=0 for this month; bump the cap then add
	// per-tag allocations. Σ allocations must stay ≤ overall (trigger-enforced).
	const month = new Date().toISOString().slice(0, 7);
	const overallPesos = 30_000;
	const { error: bcErr } = await admin
		.from("budget_config")
		.update({ overall_centavos: overallPesos * 100 })
		.eq("user_id", userId)
		.eq("month", month);
	if (bcErr) throw bcErr;

	const allocations = [
		["foods", 4_000],
		["grocery", 6_000],
		["bills", 5_000],
		["transportation", 2_000],
		["digital-subscriptions", 1_500],
		["online-shopping", 5_000],
		["personal-care", 500],
		["health", 1_000],
		["gadgets", 3_000],
	];
	await insertAll(
		"budget_allocation",
		allocations.map(([name, pesos]) => ({
			user_id: userId,
			month,
			tag_id: tagId("expense", name),
			amount_centavos: pesos * 100,
		})),
		"budget allocations",
	);

	console.log(`\n✅ seeded. Sign in at http://localhost:5173 with ${EMAIL} / ${PASSWORD}`);
}

await main();
