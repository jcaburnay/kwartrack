// Seed the local Supabase with a snapshot of the current prod database.
// Replaces the previous synthetic smoke fixture with a live prod mirror —
// kept the file name for muscle memory and existing shell aliases.
//
// What it does:
//   1. pg_dump prod's auth.users and all of public, data only.
//   2. supabase db reset --local — wipe local + reapply current migrations.
//   3. psql-load the dump in a single transaction with session_replication_role
//      = replica so AFTER triggers and FK constraint triggers don't fire mid-load.
//
// Prerequisites:
//   - .env.local must contain PROD_DATABASE_URL. Get it from the Supabase
//     Dashboard → Connect → "Session pooler" (IPv4-friendly; the direct
//     connection only resolves over IPv6). The connection string includes
//     the password; treat it like a secret.
//   - Local Supabase stack running (pnpm supabase:start).
//   - pg_dump and psql on PATH (`brew install postgresql@16` if missing).
//
// Run: node scripts/seed-smoke.mjs
//
// Heads-up: the dump contains real user data. The script writes it to a
// mkdtemp directory under $TMPDIR and deletes it on completion. If the script
// dies mid-run, that temp file persists — clean it up manually.

import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const PROD_DB = process.env.PROD_DATABASE_URL;
if (!PROD_DB) {
	console.error("Missing PROD_DATABASE_URL in .env.local. See script header.");
	process.exit(1);
}

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const tmp = mkdtempSync(join(tmpdir(), "kwartrack-seed-"));
const dataDump = join(tmp, "prod-data.sql");

try {
	// auth.users is enough for FK integrity into public.*; the rest of the auth
	// schema (audit_log_entries, sessions, refresh_tokens, identities, etc.) is
	// owned by supabase_auth_admin so even local's `postgres` superuser can't
	// load them, and nothing in our app needs them — sign back in to mint
	// fresh ones.
	// Note: --table and --schema can't be combined — --schema is silently
	// ignored when --table is set. Use multiple --table flags instead, with a
	// wildcard for public.* to mean every table in public.
	console.log("→ Dumping prod data (auth.users + public, data only)…");
	execSync(
		[
			"pg_dump",
			"--data-only",
			"--column-inserts",
			"--no-owner",
			"--no-privileges",
			"--table=auth.users",
			"--table=public.*",
			`"${PROD_DB}"`,
			">",
			`"${dataDump}"`,
		].join(" "),
		{ stdio: ["inherit", "inherit", "inherit"], shell: "/bin/bash" },
	);

	console.log("→ Resetting local schema…");
	execSync("pnpm exec supabase db reset --local", { stdio: "inherit" });

	// Wrap the load in a transaction with session_replication_role=replica so
	// AFTER triggers (balance cascades, recurring next_at compute, time-deposit
	// lifecycle, etc.) and constraint triggers (FKs across account↔recurring↔
	// transaction circles) don't fire during the bulk insert.
	console.log("→ Loading prod data into local…");
	execSync(
		`(echo "BEGIN; SET session_replication_role = replica;"; ` +
			`cat "${dataDump}"; ` +
			`echo "SET session_replication_role = origin; COMMIT;") | ` +
			`psql "${LOCAL_DB}" --set ON_ERROR_STOP=on >/dev/null`,
		{ stdio: "inherit", shell: "/bin/bash" },
	);

	console.log("\n✅ Local seeded from current prod data.");
	console.log("   Auth.users password hashes were copied verbatim — sign in with your");
	console.log("   prod credentials. To override locally with a known password, run:");
	console.log("");
	console.log(`     psql "${LOCAL_DB}" \\`);
	console.log(`       -c "UPDATE auth.users SET encrypted_password = crypt('YOUR_PW', gen_salt('bf')) WHERE email = 'YOUR_EMAIL';"`);
} finally {
	rmSync(tmp, { recursive: true, force: true });
}
