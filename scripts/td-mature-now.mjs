// Backdate the maturity_date of every TD owned by smoke@kwartrack.test to
// yesterday, then call td_check_maturity_due() so we can verify the cron's
// real-life effect (Matured badge, paused recurring, lump-sum income).
//
// Run: `node scripts/td-mature-now.mjs`
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
const admin = createClient(url, secret, { auth: { persistSession: false } });

const yesterday = (() => {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - 1);
	return d.toISOString().slice(0, 10);
})();

// Find smoke user.
let userId = null;
let page = 1;
while (true) {
	const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
	if (error) throw error;
	const f = data.users.find((u) => u.email === "smoke@kwartrack.test");
	if (f) {
		userId = f.id;
		break;
	}
	if (data.users.length < 100) break;
	page += 1;
}
if (!userId) throw new Error("smoke@kwartrack.test not found — run seed-smoke first");

const yearAgo = (() => {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - 365);
	return d.toISOString().slice(0, 10);
})();

// Reset and backdate every TD: clear is_matured, push created_at back a year
// (so the at-maturity lump-sum has a positive accrual window), set
// maturity_date to yesterday so the cron picks it up.
const { data: tds } = await admin
	.from("account")
	.select("id, name, interest_posting_interval")
	.eq("user_id", userId)
	.eq("type", "time-deposit");

for (const td of tds ?? []) {
	const { error } = await admin
		.from("account")
		.update({
			is_matured: false,
			created_at: `${yearAgo}T00:00:00Z`,
			maturity_date: yesterday,
		})
		.eq("id", td.id);
	if (error) throw error;
	console.log(`reset + backdated "${td.name}" (${td.interest_posting_interval})`);
}

// Now fire the cron.
const { data: count, error: rpcErr } = await admin.rpc("td_check_maturity_due");
if (rpcErr) throw rpcErr;
console.log(`td_check_maturity_due() processed ${count} account(s)`);
