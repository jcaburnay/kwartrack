# SpacetimeDB Migration Strategy

How to evolve the kwartrack schema without breaking production.

---

## 🚨 Read this first

**Never modify the type of an existing column.**

This includes:
- `optional()` → non-optional
- non-optional → `optional()`
- Any type swap (`u32` → `u64`, `string` → `string.optional()`, etc.)
- Column renames
- Column reorderings

**Why:** SpacetimeDB 2.1.0 has a migration bug. When you publish a column type change, it should be rejected as a forbidden migration — but the bug accepts it and silently corrupts the database's internal index catalog. After that, **every reducer panics** with `Uncaught No such index`. There is no in-place fix. Recovery requires `--clear-database`, which destroys all production data.

This is exactly what happened on **2026-04-15** with commit `4576428`. The whole DB went down. Users lost all their data.

If you remember nothing else from this doc: **only add new things to the schema; never modify what already exists.** When you need to change something that exists, use the [incremental v2 table pattern](#pattern-2-incremental-v2-table) instead of editing the original.

---

## Decision tree: "Can I make this schema change?"

Walk through this before every schema-touching commit:

```
Is my change adding something entirely new?
├─ New TABLE?                                                        → ✅ SAFE
├─ New REDUCER, PROCEDURE, or INDEX?                                 → ✅ SAFE
├─ New SCHEDULED TABLE?                                              → ✅ SAFE
└─ New COLUMN on an existing table?
   ├─ At the END of the column list?
   │  ├─ Optional (`t.xxx().optional()`)?                            → ✅ SAFE
   │  ├─ Non-optional with `.default(...)` and table is EMPTY?       → ✅ SAFE (current state ok)
   │  └─ Non-optional with `.default(...)` and table has rows?       → ⚠️ DANGEROUS — same shape as the operation that broke prod. Prefer optional.
   └─ NOT at the end (in the middle)?                                → ❌ FORBIDDEN

Is my change modifying or removing something that already exists?
├─ Changing a column's TYPE (incl. optional ↔ non-optional)?         → ❌ FORBIDDEN — use Pattern 2
├─ Renaming a column?                                                → ❌ FORBIDDEN — use Pattern 2
├─ Reordering columns?                                               → ❌ FORBIDDEN — use Pattern 2
├─ Removing a column?                                                → ❌ FORBIDDEN — leave it, stop reading it
├─ Removing a table?                                                 → ❌ FORBIDDEN — stop writing to it
├─ Adding `unique()` or `primaryKey()` to existing column?           → ❌ FORBIDDEN — use Pattern 2
├─ Removing `unique()` from a column?                                → ⚠️ Allowed but breaks subscription queries
├─ Removing `primaryKey()` annotation?                               → ⚠️ Allowed but old clients cache by old PK
├─ Changing a table from `public` → `private`?                       → ⚠️ Allowed but breaks subscribers
├─ Changing a table from `private` → `public`?                       → ✅ SAFE
├─ Changing/removing a reducer?                                      → ⚠️ Old clients calling it get errors
└─ Removing an index?                                                → ⚠️ Breaks queries that use it
```

If you land on ❌ FORBIDDEN: **stop**. Do not publish. Use Pattern 2 (incremental v2 table) instead. Do not try to "just clean up" the schema in the same commit.

If you land on ⚠️: coordinate with the client deployment. Backend-first or client-first deploy with grace period.

---

## The single rule that prevents the bug

Every schema change must be one of these:

1. **Add something entirely new** — a table, a column at the end, a reducer, a procedure, an index. The existing schema is untouched.
2. **Add a v2 table** alongside the original and migrate rows lazily on access. The original is untouched; reads go through a helper that prefers v2 and falls back to v1.

There is no third option. There is no "just tweak this one column" path that's safe. Every operation that touches an existing column risks triggering the SpacetimeDB 2.1.0 migration bug.

---

## The three categories of schema change

### ❌ Forbidden (will be rejected — or worse, accepted via the bug and corrupt the DB)

- **Removing a table**
- **Removing or modifying an existing column** — changing type, renaming, reordering, flipping `optional()`
- **Adding a column without a default value** to a populated table
- **Adding a column in the middle of a table** — new columns must go at the end
- **Changing whether a table is `scheduled`**
- **Adding a `unique()` or `primaryKey()` constraint to an existing column**

Per the SpacetimeDB docs, these should fail at publish time. In SpacetimeDB 2.1.0, **column type changes do not always fail** — they sometimes succeed and corrupt the DB. Don't rely on the publish step rejecting you.

### ⚠️ Potentially breaking (allowed, but old clients may error)

- Adding a non-optional column at end with `.default(...)` — see warning in decision tree
- Changing or removing a reducer — old clients calling it get runtime errors
- Changing a table from `public` to `private` — subscribed clients get runtime errors
- Removing a `primaryKey()` annotation — old clients still cache by old key
- Removing an index — breaks subscription queries that depend on it
- Removing a `unique()` constraint — same risk

These work, but any deployed client with the old bindings may behave badly. Coordinate the rollout: deploy backend, then ship a client build, or vice versa with a grace period.

### ✅ Safe (always allowed, doesn't break clients)

- Adding a new table
- Adding a new column at the end of a table **with `optional()`** (no default needed; `None` is the implicit default)
- Adding an index
- Adding or removing `autoInc()` on a column
- Changing a table from `private` to `public`
- Adding a new reducer or procedure

These are free. Publish and move on.

---

## Recommended patterns

### Pattern 1: Additive (use by default)

Add a new table, or a new optional column at the end of an existing table.

```ts
// Adding a new column to an existing table
export const account = table({ name: "account", ... }, {
  id: t.u64().primaryKey().autoInc(),
  ownerIdentity: t.identity(),
  name: t.string(),
  isStandalone: t.bool(),
  createdAt: t.timestamp(),
  iconBankId: t.string().optional(), // ← new column, at end, optional
});
```

```ts
// Adding a brand-new table
export const time_deposit_metadata = table(
  { name: "time_deposit_metadata", indexes: [...] },
  { /* all columns fresh */ }
);

// Add to schema export
const spacetimedb = schema({
  // ... existing tables ...
  time_deposit_metadata, // ← new
});
```

**Precedent in this repo:**
- `account.iconBankId` — optional column added at end (works on populated tables)
- `time_deposit_metadata` and `td_maturity_schedule` — entirely new tables added in commit `33ffc46`
- `recurring_transaction_definition_v2` — new table added in commit `4968122`

### Pattern 2: Incremental v2 table

When you need to **change** an existing column (type, name, position, optional flag), do **not** edit the original column. Create a new v2 table alongside the original and migrate rows lazily on access.

This is the only safe way to evolve a schema once data exists.

**Recipe:**

1. **Add the v2 table** with the desired schema. Keep v1 untouched.

   ```ts
   // Old (untouched)
   export const recurring_transaction_definition = table({...}, {
     id: t.u64().primaryKey().autoInc(),
     // ... original columns ...
     interval: t.string(),
   });

   // New
   export const recurring_transaction_definition_v2 = table({...}, {
     id: t.u64().primaryKey().autoInc(),
     // ... original columns ...
     interval: t.string(),
     anchorMonth: t.u8(),     // ← new
     anchorDayOfWeek: t.u8(), // ← new
   });
   ```

2. **Write a lazy-migration helper** that every relevant reducer calls before reading the row. It checks v2 first; if missing, reads v1, computes the v2 shape, inserts into v2, returns the v2 row.

   ```ts
   function migrateV1RowToV2(ctx: AppCtx, definitionId: bigint) {
     const v2 = ctx.db.recurring_transaction_definition_v2.id.find(definitionId);
     if (v2) return v2;
     const v1 = ctx.db.recurring_transaction_definition.id.find(definitionId);
     if (!v1) return undefined;
     return ctx.db.recurring_transaction_definition_v2.insert({
       ...v1,
       anchorMonth: 0,
       anchorDayOfWeek: 0,
     });
   }
   ```

3. **Update every reducer that reads the table** to call the helper. New reducers should only read v2 (the helper handles the migration).

4. **Decide on dual-writes.** If old clients still read v1, you must also write to v1 from any reducer that mutates v2 — otherwise old clients see stale data. Drop dual-writing only after every client has been updated.

5. **The original table never gets removed.** Per SpacetimeDB rules, dropping a table is forbidden. After all rows have been migrated and no client reads v1, you can stop writing to v1, but the table stays in the schema forever. Live with the empty husk.

**Precedent in this repo:**
- `recurring_transaction_definition` (v1) → `recurring_transaction_definition_v2` (v2) — see `migrateV1RowToV2()` in `server/src/index.ts`. This is the canonical example to follow.

### Pattern 3: Clean break (last resort, accepts data loss)

Only appropriate when:
- You're working on `kwartrack-dev` (no production data)
- OR you've explicitly decided that production data loss is acceptable

```bash
spacetime publish kwartrack --clear-database -y --module-path server
```

**Never run this on production without an explicit data-rescue plan**, a fresh snapshot, and stakeholder approval. After running it, every user will need to recreate their data from scratch.

---

## Pre-publish workflow (mandatory for any `server/**` change)

Before pushing a commit that touches `server/**`, run through this checklist:

```bash
# 1. Review the schema diff against main
git diff main -- server/src/schema.ts

# 2. Walk through the decision tree above for every change in the diff
#    If anything lands on ❌ FORBIDDEN, stop and use Pattern 2 instead

# 3. Build to catch type errors
pnpm server:build

# 4. Publish to dev FIRST (server is set in spacetime.local.json)
spacetime publish kwartrack-dev --module-path server -y --server maincloud

# 5. Check dev logs for panics — wait at least 30s after publish
spacetime logs kwartrack-dev --num-lines 30

# 6. Smoke-test critical reducers in the dev app:
#    - Sign in
#    - Create an account, sub-account, transaction
#    - Edit a budget
#    - Create a recurring definition
#    - Anything else your change affects

# 7. Snapshot prod (cheap — do it every time)
TOKEN=$(python3 -c "import tomllib; print(tomllib.load(open('$HOME/.config/spacetime/cli.toml','rb'))['spacetimedb_token'])")
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p .local-backups/$DATE
for t in account sub_account transaction budget_config budget_allocation \
         user_profile identity_alias user_tag_config \
         recurring_transaction_definition recurring_transaction_definition_v2 \
         time_deposit_metadata split_event split_participant debt \
         recurring_transaction_schedule td_maturity_schedule; do
  curl -sS -X POST "https://maincloud.spacetimedb.com/v1/database/kwartrack/sql" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/plain" \
    --data "SELECT * FROM $t" > ".local-backups/$DATE/$t.json"
done

# 8. Only then push the commit (CI auto-publishes prod via .github/workflows/ci.yml)
git push origin main
```

CI's `publish-server` job runs on push to `main` whenever `server/**` files change. So pushing IS publishing. Treat the push as the production deploy event.

---

## Recovery procedure: "I think I just broke production"

**Symptom:** `spacetime logs kwartrack` shows repeated panics like:

```
PANIC: <reducer_name> ../node_modules/.../spacetimedb/dist/server/index.mjs:6660
  Uncaught No such index
    in makeTableView
    in get #dbView
    in __call_reducer__
```

The reducer name varies — every reducer panics, including unrelated ones like `link_clerk_identity`. From the user's perspective, the app appears completely unresponsive: nothing loads, nothing saves.

**Cause:** A schema migration corrupted the index-name catalog. Almost always triggered by changing an existing column's type (the operation that broke us in `4576428`).

**Diagnose the trigger:**

```bash
git log --oneline -- server/src/schema.ts | head
spacetime logs kwartrack --num-lines 50    # confirm the panic class
```

Find the most recent commit that touched `schema.ts` — that's almost certainly the culprit.

### Options for recovery

**Option A — Clear and restart (current accepted strategy)**

```bash
# 1. Snapshot whatever data exists, even if you can't read it via reducers
#    (the SQL API still works because it bypasses the reducer code path)
TOKEN=$(python3 -c "import tomllib; print(tomllib.load(open('$HOME/.config/spacetime/cli.toml','rb'))['spacetimedb_token'])")
DATE=$(date +%Y%m%d-%H%M%S-incident)
mkdir -p .local-backups/$DATE
for t in account sub_account transaction ...; do
  curl -sS -X POST "https://maincloud.spacetimedb.com/v1/database/kwartrack/sql" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/plain" \
    --data "SELECT * FROM $t" > ".local-backups/$DATE/$t.json"
done

# 2. Clear and republish
spacetime publish kwartrack --clear-database -y --module-path server

# 3. Notify users — they need to sign in again and recreate their data,
#    OR you need to build a restore pipeline (separate effort)
```

After the clear, users sign back in via Clerk and `link_clerk_identity` will create fresh `user_profile` and `identity_alias` rows. **Do not delete anything in Clerk** — Clerk identities are the bridge between old user accounts and new SpacetimeDB identities.

**Option B — Hold prod broken while filing an upstream bug**

Only appropriate if:
- The broken state is acceptable for hours or days
- You have a clear data-rescue plan ready

File an issue with Clockwork Labs (Discord, GitHub) describing the trigger commit and the panic. Wait for an SDK fix. This is rarely the right call for a real production app.

### What NOT to do

- **Don't try to revert the offending commit and republish.** Removing a column is a forbidden migration — the publish will be rejected with "breaking change" errors. You can't unwind in place.
- **Don't republish the same broken module hoping for different behavior.** The catalog state is the problem, not the program.
- **Don't delete the database via the SpacetimeDB dashboard without a snapshot.** You lose your only chance to read the data via SQL.
- **Don't touch Clerk.** Clerk and SpacetimeDB are independent. Clearing Clerk users would destroy the bridge between old user accounts and any future restore.

---

## Historical post-mortem

Every successful migration in this project's history followed one of two safe patterns: **new table** or **optional column at end**. The first commit to break those rules broke production.

| Commit | Change | Outcome |
|--------|--------|---------|
| `663f396` | Initial schema (v1 launch) | Day-1, no migration |
| `ad8c208` | Rename `partition` → `sub_account` | ✅ Pre-production, no live data |
| `4968122` | New table `recurring_transaction_definition_v2` | ✅ New table — Pattern 1 |
| `33ffc46` | New tables `time_deposit_metadata` + `td_maturity_schedule` | ✅ New tables — Pattern 1 |
| `61c1ddf` | Add `principalCentavos` column to `time_deposit_metadata` (middle position, no default) | ✅ Worked because target table was empty — don't rely on this |
| `d38713a` | Add `splitMethod`/`shareCount` as **optional at end** of split tables | ✅ Optional column at end — Pattern 1 |
| `a4d964b` | Add `.default(undefined)` to those optional fields | ✅ Cosmetic, same type |
| **`4576428`** | Change `splitMethod`/`shareCount` from `optional()` to non-optional `default(...)` | 💥 **Broke production** — column type change |

`4576428` was the **first commit in the project's history** to modify an existing column's type. The SpacetimeDB 2.1.0 bug let it through and corrupted the index catalog. Recovery required `--clear-database` and full data loss.

The lesson: every schema change you make should look like one of the green rows above. None of them changed an existing column.

---

## Quick-reference table

| Change | Pattern | Precedent in this repo |
|--------|---------|------------------------|
| New feature needing its own data | **Pattern 1: New table** | `time_deposit_metadata` (`33ffc46`) |
| New optional field on existing record | **Pattern 1: Optional column at end** | `iconBankId` on `account` (v1) |
| New non-optional field on existing record | **AVOID** — add as optional, treat null as valid in code | — |
| Rename a column | **Pattern 2: v2 table** | — (don't do it) |
| Change a column's type | **Pattern 2: v2 table** | `recurring_transaction_definition_v2` (`4968122`) |
| Reorder columns | **Pattern 2: v2 table** | — (don't do it) |
| Tighten column (`optional()` → non-optional) | **AVOID** — caused the 2026-04-15 incident | broke prod in `4576428` |
| Loosen column (non-optional → `optional()`) | **AVOID** — same forbidden type-change class | — |
| Add `unique()` to existing column | **Pattern 2: v2 table** | — |
| New reducer | Just add it | many |
| New procedure | Just add it | — |
| New index on existing column | Just add it | — |
| New scheduled table | Pattern 1: new table | `td_maturity_schedule` (`33ffc46`) |
| Remove a column | **AVOID** — leave it, stop reading it | — |
| Remove an index | **AVOID** — confirm no query references it first | — |
| Drop a table | **AVOID** — deprecate, stop writing | — |
| Change `private` → `public` | Safe | — |
| Change `public` → `private` | Breaks existing subscriptions | — |

**Rule of thumb:** "add new" → safe. "modify existing" → Pattern 2. There is no shortcut.

---

## References

- [SpacetimeDB: Automatic Migrations](https://spacetimedb.com/docs/databases/automatic-migrations)
- [SpacetimeDB: Incremental Migrations](https://spacetimedb.com/docs/databases/incremental-migrations)
- [SpacetimeDB: Default Values](https://spacetimedb.com/docs/tables/default-values)
- [SpacetimeDB FAQ: Schema & Migrations](https://spacetimedb.com/docs/intro/faq)
- `server/CLAUDE.md` — SpacetimeDB TypeScript SDK rules (project-specific)
- `server/src/index.ts` — `migrateV1RowToV2()` is the canonical incremental-migration helper to copy when you need Pattern 2
