# KT-E003 — Phase 3: Core Financial Operations

**Project:** Kwartrack  
**Document version:** 1.0  
**Prepared:** 2026-11-06  
**Epic status:** Planned — implementation has not started  
**Predecessors:** KT-E001 (local foundation), KT-E002 (authentication and ownership)  
**Ticket range:** KT-0020–KT-0032  
**Format:** Standalone backlog. Ticket IDs are planning identifiers, not existing GitHub issues.

## 1. Objective and completion outcome

Build the local NestJS financial API for owned account groups, tags, everyday accounts, credit accounts, and manually entered expense/income/transfer transactions. Preserve the existing balance and paired-fee behavior while moving orchestration into testable NestJS services.

At completion, Alice can create accounts, record money movements, edit or delete a movement, and receive consistent balances. Bob cannot read, reference, or mutate Alice's data. Retries cannot duplicate a committed financial command. Independent reconciliation and failure/concurrency tests demonstrate correctness against real local PostgreSQL.

This phase implements the backend. The existing React app and hosted Supabase backend remain unchanged. Phase 4 connects the frontend; phase 5 adds the remaining business features and automation; phase 6 adds realtime and MCP integration.

### Included

- Behavior inventory and reconciliation of specification/code differences.
- Financial schema, exact integer money handling, local migrations, owner constraints, and indexing.
- Per-user tag bootstrap, protected system tags, and account groups.
- Cash, e-wallet, savings, and credit account lifecycle.
- Expenses, income, transfers, paired fees, edits, and hard deletion with reversal.
- Atomic balance updates, safe concurrent mutations, and optimistic edit conflict detection.
- Durable idempotency for financial commands.
- Owned list/detail/filter endpoints and basic account totals.
- Read-only reconciliation, deterministic fixtures, integration tests, API documentation, and handoff.

### Excluded or explicitly staged

- Actual frontend migration, production cutover, hosted AWS resources, and real financial data import.
- Budget management, debt/split operations, recurring schedules, and time-deposit interest/maturity processing.
- **Time-deposit creation is deferred to phase 5** because the current workflow creates linked recurring behavior. Do not expose a partial create flow that silently omits interest scheduling. Reserve/document its enum/domain support, but reject it on the phase-3 public create API with a documented validation error. Completing phase 3 is not full account-type parity.
- Recurring/debt/split foreign keys and business deletion rules are added when their actual tables/features arrive. Do not pretend those relationships are already enforced.
- Realtime event transport, SQS/EventBridge jobs, MCP writes, CSV import, and attachments.
- Multi-currency, bank synchronization, formal double-entry accounting, and a new ledger/event-sourcing architecture.
- Production immutable audit history. Current product behavior allows transaction edits and hard deletion; retain that behavior and document the tradeoff.

## 2. Inputs and prerequisite evidence

Read the current [phase-1-local-backend-foundation.md](phase-1-local-backend-foundation.md) and [phase-2-authentication-and-ownership.md](phase-2-authentication-and-ownership.md). Keep these files beside this document for relative links.

Do not treat the predecessor plans as implementation evidence. Check the actual repository and record which dependencies are done before starting.

| Prerequisite | Needed capability |
|---|---|
| KT-0004–KT-0005 | Real local PostgreSQL, Drizzle provider, isolated SQL migrations |
| KT-0006–KT-0009 | Health/readiness, gateway path, validation CI, reproducible setup |
| KT-0012–KT-0014 | Strict access-token verification and trusted internal `userId` |
| KT-0015 | Proven owner-scoped query conventions |
| KT-0018–KT-0019 | Isolation tests and documented identity contract |

### Repository evidence inspected for this plan

- `specs.md`: accounts, transactions, fee pairing, tag rules, and scheduling semantics.
- `supabase/migrations/20260424133300_transactions.sql`: transaction constraints, balance triggers, paired-fee behavior, and removal of the account nonnegative-balance constraint.
- `apps/web/src/__tests__/balanceTriggers.integration.test.ts`: create/edit/delete, credit-sign, and fee synchronization cases.
- Search results identifying existing transaction/account hooks and balance/report helpers from earlier repository review.

The inspected `specs.md` blob SHA was `d46cf360fec0d3fa840c8561dae01a0c244baf70`; the transaction migration blob SHA was `0aea941813f165bef4800230adbfe0fabfdd3ba3`. These identify inspected files, not a claim that the entire repository was exhaustively audited. KT-0020 must inspect later migrations and current validation helpers before implementation.

### Constraints carried forward

- Use a branch/worktree; do not merge or deploy as part of this local phase.
- Keep API migrations out of `supabase/migrations` and do not rewrite deployed migration history.
- Preserve existing web/MCP package behavior and all unrelated user changes.
- Follow current `AGENTS.md`, strict TypeScript, Biome, and workspace version conventions.
- Use synthetic records and local credentials only.
- Reuse the existing verified principal. Never accept ownership from client fields.

## 3. Behavior baseline and decisions

### Observed rules to preserve

| Area | Existing intended/observed behavior |
|---|---|
| Currency | PHP, stored in integer centavos |
| Opening balance | Sets account balance directly; no automatic opening transaction |
| Opening balance edits | Not allowed after creation |
| Account type changes | Not allowed after creation |
| Credit balance | Positive values represent debt; money-in reduces debt and money-out increases it |
| Credit creation | Initial debt cannot exceed a positive credit limit |
| Later credit over-limit | Allowed; surface as derived information |
| Negative balances | Transaction migration deliberately allows them for backfill/correction workflows |
| Transaction dates | Past/future dates accepted; future-dated records affect balances immediately |
| Expense/income tags | Required; verify matching type and owned tag |
| Transfer tags | Optional; any user-facing tag scope may be selected |
| Transfer source/destination | Different owned accounts; credit accounts may be on either side |
| Transfer fee | Positive when supplied; represented by an automatic expense child from the source account |
| Transaction edit | Reverse old effect and apply new effect, including account/type changes |
| Transaction delete | Hard-delete and reverse its effect; remove and reverse associated fee child |
| Archives | Hide from active account choices/totals; preserve historical transaction references |
| System tags | Hidden from manual selection and protected from rename/delete |

The specification describes assets as nonnegative, while the inspected transaction migration explicitly permits negative balances. Preserve negative running balances and do not introduce an insufficient-funds check without an explicit product decision. KT-0020 must record this discrepancy and confirm later migrations have not changed it.

Existing balance tests sometimes insert a tag of a different type via administrative database access. Those tests are evidence for arithmetic, not evidence that the new public API should permit invalid tag selection. Separate public validation from internal arithmetic fixtures.

### Recommended architecture decision: one financial writer

Use a NestJS financial command service as the sole writer of transaction rows, fee children, and account balance deltas in the new local database. PostgreSQL retains structural checks, foreign keys, unique constraints, and transaction durability.

**Do not copy balance/paired-fee mutation triggers into this database while also applying the same effects in NestJS.** That would double-count movements. Database timestamps or structural constraints are separate from balance mutation ownership.

Controllers validate transport inputs and pass the verified principal. Services validate owned references and invoke a shared command executor. All writes for one command use the same Drizzle transaction handle. Future workers/MCP operations must call this same boundary rather than writing rows independently.

This is a deliberate implementation change preserving observable financial behavior. It is not a claim that application-managed balances are universally preferable to triggers.

### Money contract

**Recommended new API contract:** money is a canonical base-10 integer string in centavos. PostgreSQL uses `bigint`; service/domain arithmetic uses JavaScript `bigint`. Basis points, when introduced later, remain integers.

Examples: `"10000"` means PHP 100.00; a running balance may be `"-500"`. Transaction amounts must be positive; opening balances nonnegative. Fee absence is `null`/omitted; an explicitly supplied `"0"` is invalid under the existing fee rule.

- Reject decimals, exponent syntax, whitespace, plus signs, unsafe numeric JSON values, and values outside PostgreSQL bigint range.
- Canonicalize validated inputs before hashing idempotency payloads.
- Serialize every monetary result, including totals, as a string; never return native JS `bigint` in JSON.
- Aggregates can exceed a single-row bigint range; keep aggregate arithmetic exact and define bounds before narrowing.
- This is a new API representation, not an existing frontend convention. Phase 4 must adapt formatting/calculation boundaries explicitly. Do not silently coerce large values to `number`.

### Dates, ordering, and archived edits

Use a calendar `date` (`YYYY-MM-DD`) for transaction dates, not a timestamp converted through UTC. Use UTC timestamps for created/updated metadata. A future date is not a schedule.

Default list ordering is `date DESC, created_at DESC, id DESC` for deterministic ties. Add bounded pagination and documented filter behavior.

**Proposed archived-edit policy, to confirm in KT-0020:** historical metadata edits and deletion remain possible on archived accounts; new postings or changes that introduce new account/amount/type/fee effects involving an archived account are rejected until unarchived. Preserve the ability to reverse/delete history, and never reject a required reversal merely because an old account is now archived. Treat this as an explicit product decision where current behavior is ambiguous.

## 4. Financial correctness contract

### Balance arithmetic

Define `sign(account) = +1` for assets and `-1` for credit liabilities. A transaction's signed amount effect is:

- Source: `-amount × sign(source)`.
- Destination: `+amount × sign(destination)`.
- Expense has only a source; income has only a destination.
- Transfer fee child is an independent expense effect from the source; never charge it once on the parent and again on the child.

Edit applies `-old effects + new effects` across the union of affected accounts. Delete applies `-old effects`. Aggregate account deltas before writing so the same account appearing in old/new legs is updated correctly once per logical operation.

| Independent example, all amounts in centavos | Starting balances | Operation | Expected balances |
|---|---|---|---|
| Asset expense | Cash 100000 | Expense 20000 | Cash 80000 |
| Asset income | Cash 100000 | Income 20000 | Cash 120000 |
| Asset transfer + fee | Cash 100000; Wallet 50000 | Transfer 20000; fee 500 | Cash 79500; Wallet 70000 |
| Credit purchase | Card debt 20000 | Expense 30000 | Card debt 50000 |
| Credit refund | Card debt 20000 | Income 5000 | Card debt 15000 |
| Card payment | Cash 100000; Card debt 20000 | Transfer 15000 to card | Cash 85000; Card debt 5000 |
| Cash advance | Card debt 20000; Cash 100000 | Transfer 10000 from card | Card debt 30000; Cash 110000 |
| Fee on credit source | Card debt 20000; Cash 100000 | Transfer 10000; fee 500 | Card debt 30500; Cash 110000 |
| Credit-to-credit transfer | Card A debt 20000; Card B debt 30000 | Transfer 10000 A → B | A debt 30000; B debt 20000 |

A transfer without a fee preserves net worth when all affected accounts are included. A fee decreases net worth by the fee. The sum of raw account balances is not the correct invariant when credit accounts are involved. Archived-account exclusion changes displayed totals; do not confuse that with a money movement.

### Atomicity and concurrency recommendation

For the initial personal-finance backend, serialize each user's financial/metadata mutations by locking their `app_user` row at the start of one database transaction. This is a deliberately simple per-user concurrency boundary, not a global lock.

Every relevant mutation—groups/tags that affect references, account create/edit/archive/delete, and transaction commands—must follow the same lock-first protocol. Bootstrap must follow it too. Obtain no other write lock before this owner lock. Then reread and validate referenced records inside the transaction.

This trades same-user write throughput for straightforward correctness. Different users remain independent. Keep transactions short; no network calls or JWT/JWKS fetches inside the locked section. Identity verification/resolution happens before it. In phase 5, workers must use this protocol or an explicitly revised locking design.

Use atomic SQL balance increments within the transaction, not a stale balance value from outside it. Handle lock timeout/deadlock/serialization failures with bounded retries of the entire command, not just one statement. Test across separate database connections and API instances; an in-memory mutex is insufficient.

### Edit conflict protection

Add an integer version to mutable financial resources. Require an expected version for account/transaction updates and transaction deletion. Reject stale versions with 409 and no mutation. This is separate from locking: locks protect arithmetic, while versions protect against silently overwriting a user's stale form.

### Idempotency recommendation

Require `Idempotency-Key` for transaction create/edit/delete. Persist a record keyed by `(owner_user_id, operation, key)`, with canonical request hash, status, and replay response, in the same transaction as the money movement.

- Same key and same request after commit returns the original result without rerunning effects.
- Same key and different request returns 409.
- Different owners may use the same key independently.
- Retry after rollback can run again; no successful result or permanent pending marker survives a rollback.
- Lookup a completed replay before checking the old expected version or existence of a now-deleted resource.
- Store no bearer tokens. Keep financial command metadata/response access owner-scoped.
- No automatic key expiry in this local phase; document retention/cleanup as a later operational decision.
- Idempotency prevents duplicate application effects for a key, not arbitrary duplicate human submissions using different keys.

## 5. Proposed schema and API surface

| Table | Responsibility |
|---|---|
| `account_group` | Owned institution/group names |
| `tag` | Owned display name/type, immutable system identity where applicable |
| `finance_bootstrap` | Per-user seed version/completion marker |
| `account` | Owner, group, type, immutable opening balance, current balance, credit limit, archive state, version |
| `financial_transaction` | Owner, amount/type/date, account/tag references, optional fee/parent, timestamps, version |
| `financial_command` | Durable idempotency keys, request hashes, replay outcomes |

Use an unambiguous new table name such as `financial_transaction` to avoid SQL keyword confusion. Map legacy fields in a compatibility document instead of requiring identical database naming.

Use composite owner-aware foreign keys where practical: an `(owner_user_id, account_id)` reference must target the same owner's account. Apply equivalent protection to tags, groups, and parent/child references. Add matching unique constraints on referenced pairs. Cross-table semantic rules still require service validation.

Enforce at most one fee child per parent, valid per-type fields, positive amounts, positive-or-null fee, and appropriate delete restrictions. Do not add unsupported foreign keys to future recurring/debt tables merely to reserve columns.

| Endpoint group | Planned behavior |
|---|---|
| `/v1/groups` and `/:id` | Owned create/list/rename/delete |
| `/v1/tags` and `/:id` | Owned list/create/rename/delete; system tags locked |
| `/v1/accounts` and `/:id` | Create/read/update supported account types; archive toggle and guarded deletion |
| `/v1/accounts/summary` | Assets, liabilities, net worth; archived accounts excluded by documented rule |
| `/v1/transactions` and `/:id` | Owned manual CRUD, filters, paging, versioned edits, durable idempotency |

All routes are protected using phase 2's guard. Do not expose direct balance setters, fee-child mutation endpoints, client ownership fields, or direct database credentials. List and detail endpoints present the parent transaction with its fee metadata; derived child rows are not independent editable records.

Use 400 for malformed inputs/unsupported account type, 401 for invalid credentials, 404 for missing/not-owned objects, 409 for version/idempotency/reference conflicts, and a bounded 503 for transient infrastructure failures. A duplicate name is a 409. Document any additional error codes in OpenAPI.

## 6. Agile backlog and delivery groups

**Lifecycle:** Backlog → Ready → In progress → Review → Done; use Blocked with evidence when prerequisites or unresolved rules prevent acceptance. Prefer focused PRs and stable ticket IDs.

| ID | Ticket | Type | Points | Dependencies |
|---|---|---|---:|---|
| [KT-0020](#kt-0020) | Behavior inventory and financial ADR | Spike | 3 | Phase-2 contract |
| [KT-0021](#kt-0021) | Financial schema and money/date contracts | Task | 5 | KT-0020, KT-0005, KT-0013 |
| [KT-0022](#kt-0022) | Groups, tags, and per-user bootstrap | Feature | 5 | KT-0021, KT-0014 |
| [KT-0023](#kt-0023) | Everyday and credit account lifecycle | Feature | 5 | KT-0022 |
| [KT-0024](#kt-0024) | Atomic financial command engine | Task | 5 | KT-0023 |
| [KT-0025](#kt-0025) | Expense and income operations | Feature | 3 | KT-0024 |
| [KT-0026](#kt-0026) | Transfers and paired fees | Feature | 5 | KT-0025 |
| [KT-0027](#kt-0027) | Transaction edits, conversion, and deletion | Feature | 5 | KT-0026 |
| [KT-0028](#kt-0028) | Durable command idempotency and replay | Task | 5 | KT-0027 |
| [KT-0029](#kt-0029) | Owned queries, pagination, and totals | Feature | 5 | KT-0026; final regression after KT-0028 |
| [KT-0030](#kt-0030) | Independent reconciliation and fixtures | Task | 3 | KT-0028, KT-0029 |
| [KT-0031](#kt-0031) | Financial parity, failure, and concurrency suite | Task | 5 | KT-0030 |
| [KT-0032](#kt-0032) | API documentation, demo, and phase-4 handoff | Task | 3 | KT-0031 |

**Initial estimate: 57 points.** All tickets are high priority for epic completion. Points indicate complexity, not hours or deadlines. This is a larger phase because financial correctness requires more than CRUD. Split oversized tickets after KT-0020 without renumbering existing work.

Suggested iterations:

1. Rules/schema/reference data: KT-0020–KT-0023.
2. Money movement: KT-0024–KT-0027.
3. Reliability/read models: KT-0028–KT-0030.
4. Evidence/handoff: KT-0031–KT-0032.

Tests accompany implementation tickets. KT-0031 consolidates cross-feature evidence; it does not postpone basic testing until the end. Do not present financial write endpoints as phase-complete before idempotency and conflict behavior are integrated.

## KT-0020

### Inventory existing behavior and decide the financial boundary

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Spike | **Estimate:** 3 points  
**Depends on:** Phase-2 identity contract  
**Unblocks:** [KT-0021](#kt-0021)  
**Branch:** `docs/KT-0020-financial-contract`

**Story:** As a developer, I want a precise behavior baseline so replacing Supabase does not unintentionally change how money is recorded.

#### Implementation tasks

1. Read current specs, account/transaction/tag migrations including later overrides, validators, query hooks, and balance tests.
2. Build a parity matrix with observed rule, source path, desired API behavior, and test case.
3. Record and resolve discrepancies: negative balances, tag-type test fixtures, archive edits, fee-child access, and group/tag deletion behavior.
4. Write the ADR for service-owned balances, per-user mutation locking, exact money strings, immutable opening balances, versions, and idempotency.
5. Confirm time-deposit creation remains explicitly deferred with its automation to phase 5.
6. Define API DTOs, errors, sorting/filter expectations, and phase-4 adaptation needs.

#### Technical notes

- The inspected transaction migration is not necessarily the last migration affecting its functions. Search definitions and overrides before concluding behavior.
- Treat specs as product intent and runtime code/tests as implementation evidence. Do not silently choose whichever is convenient when they disagree.
- Record recommendations as changes when they differ from current behavior, especially decimal-string API money and stale-edit rejection.
- Existing administrative trigger tests may bypass public API rules; do not copy their fixtures into public validation assertions unchanged.

#### Acceptance criteria

- [ ] Every in-scope financial rule has a source and expected test.
- [ ] Negative/future-date/credit-sign behavior is explicit.
- [ ] Ambiguous archive/group/tag rules have a recorded decision before dependent implementation.
- [ ] One balance writer is selected and double-application risks are addressed.
- [ ] Deferred features and API compatibility changes are visible.

**Verification:** Review matrix against current files; no production data needed.  
**Learning checkpoint:** Explain observable behavior versus implementation, why backdating differs from scheduling, and why double-applying triggers/service effects is dangerous.

## KT-0021

### Implement schema, money serialization, and date validation

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Task | **Estimate:** 5 points  
**Depends on:** [KT-0020](#kt-0020), KT-0005, KT-0013  
**Unblocks:** [KT-0022](#kt-0022)  
**Branch:** `feat/KT-0021-financial-schema`

**Story:** As a developer, I want exact money types and owner-aware database constraints before adding financial writes.

#### Implementation tasks

1. Add reviewed migrations for groups, tags, bootstrap marker, accounts, transactions, and command records.
2. Define owner-aware foreign keys/unique indexes and restrictions on deleting referenced objects.
3. Add transaction type/leg/fee constraints and a unique parent reference for derived fee children.
4. Add immutable opening balance data, current balance, and resource versions; do not copy balance mutation triggers.
5. Implement canonical integer-string parsing, bigint arithmetic/serialization, bounds checks, and date-only validation.
6. Add transaction/list indexes based on owner/date/account/tag access patterns; avoid speculative indexes.
7. Verify migrations against empty and existing phase-2 databases, preserving user mappings and probes.

#### Technical notes

- PostgreSQL bigint and JSON number ranges differ. Avoid a global `pg` parser that converts bigint to potentially unsafe JS numbers.
- Preserve negative running balances while constraining nonnegative opening balances and positive transaction amounts.
- Allow negative arithmetic intermediate results; reject only unsupported range/invalid business input.
- A nullable self-reference needs both owner consistency and single-child uniqueness; service logic still validates child semantics.
- A cascade deletes rows but does not reverse balances when triggers are absent. Commands must compute reversals explicitly.

#### Acceptance criteria

- [ ] Migrations are isolated and repeatable without resetting existing users.
- [ ] Invalid cross-owner references and structural transaction shapes fail.
- [ ] Large exact values round-trip without precision loss.
- [ ] Decimal/exponent/unsafe numeric JSON inputs and impossible dates are rejected.
- [ ] Raw bigint never reaches JSON serialization unconverted.
- [ ] Database has no duplicate balance/fee mutation trigger path.

**Verification:** SQL constraint tests and parser boundary tests, including bigint limits, leap dates, negative balances, and aggregate serialization.  
**Learning checkpoint:** Explain constraints versus service rules, bigint versus floating point, and calendar dates versus instants.

## KT-0022

### Add owned groups, tags, and idempotent finance bootstrap

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Feature | **Estimate:** 5 points  
**Depends on:** [KT-0021](#kt-0021), KT-0014  
**Unblocks:** [KT-0023](#kt-0023)  
**Branch:** `feat/KT-0022-reference-data`

**Story:** As a signed-in user, I want my own categories and account groups so financial records can reference stable owned IDs.

#### Implementation tasks

1. Implement group/tag CRUD with ownership, normalized-name validation, and the uniqueness/deletion rules resolved in KT-0020.
2. Add a finance-bootstrap service invoked before financial module use, separate from JWT verification logic.
3. Under the owner lock, seed the default tag set and a bootstrap version marker once per application user.
4. Give system tags a stable immutable code distinct from editable display names; enforce at most one system code per user.
5. Prevent system-tag rename/delete/manual assignment. Support internal `any` tag scope for later settlement tags without exposing it as a normal user-created type.
6. Preserve same-name tags in different scopes, such as expense and income `gifts`.
7. Block deletion of referenced tags/groups according to the resolved product rules; add future-feature follow-ups for references not implemented yet.

#### Technical notes

- Seed-on-every-request without a marker can recreate a default tag a user deliberately deleted. Record completed bootstrap and do not recreate user-facing defaults on routine reads.
- Resolve system tags by stable code/owner, not display name or a global shared ID.
- Initial concurrent financial requests must not race to insert duplicate seeds.
- Follow the same owner-lock protocol used by later writes so rename/delete cannot race with reference validation.

#### Acceptance criteria

- [ ] Two users receive distinct tags and can reuse names independently.
- [ ] Repeat/concurrent bootstrap does not duplicate defaults or restore deliberately deleted defaults.
- [ ] System tags remain immutable and unavailable for manual selection.
- [ ] Foreign-user IDs are rejected without disclosing their data.
- [ ] Referenced-object deletion cannot orphan financial records.

**Verification:** Bootstrap twice/concurrently, delete a permitted unused default, repeat bootstrap, and run cross-user CRUD cases.  
**Learning checkpoint:** Explain seed idempotency, stable IDs versus labels, and reference validation under concurrency.

## KT-0023

### Implement everyday and credit account lifecycle

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Feature | **Estimate:** 5 points  
**Depends on:** [KT-0022](#kt-0022)  
**Unblocks:** [KT-0024](#kt-0024)  
**Branch:** `feat/KT-0023-accounts`

**Story:** As a user, I want owned accounts with correct starting balances, credit limits, and archive behavior.

#### Implementation tasks

1. Implement creation for cash, e-wallet, savings, and credit accounts using validated owned groups.
2. Set opening/current balance atomically without creating a synthetic transaction.
3. Enforce name rules and per-user uniqueness, positive credit limit, and initial credit debt no greater than limit.
4. Permit supported metadata/limit/group changes while rejecting type/opening-balance/current-balance setters.
5. Add version-aware updates and archive/unarchive behavior.
6. Guard deletion with owned reference checks and SQL foreign keys; do not cascade away financial history.
7. Return documented validation errors for time-deposit creation until phase 5 implements the complete lifecycle.

#### Technical notes

- Initial balance restrictions are not ongoing spending restrictions. Later negative asset balances and credit over-limit states are valid under the baseline.
- Account deletion racing with transaction creation must use the common owner lock and database referential constraints.
- Display credit availability/utilization as derived data, not independently mutable columns.
- Use explicit nullable group removal semantics; do not interpret omitted fields as clearing them.

#### Acceptance criteria

- [ ] Opening/current balance match at creation with no transaction rows.
- [ ] Type/opening/current balance edits are rejected.
- [ ] Credit creation constraints and duplicate-name conflicts are tested.
- [ ] Archive is reversible and does not delete history or zero balance.
- [ ] Referenced accounts cannot be deleted.
- [ ] Cross-owner group assignment fails atomically.
- [ ] Unsupported time-deposit creation fails clearly rather than creating incomplete behavior.

**Verification:** CRUD/version/archive tests and deletion-vs-create concurrency coverage once KT-0025 exists.  
**Learning checkpoint:** Explain immutable opening facts, stored balance versus derived credit metrics, and archive versus deletion.

## KT-0024

### Build the atomic financial command engine

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Task | **Estimate:** 5 points  
**Depends on:** [KT-0023](#kt-0023)  
**Unblocks:** [KT-0025](#kt-0025)  
**Branch:** `feat/KT-0024-financial-commands`

**Story:** As a maintainer, I want one transaction boundary for all financial effects so future features cannot partially update balances.

#### Implementation tasks

1. Implement pure delta calculation from account type and transaction legs, with exact bigint arithmetic.
2. Add a command executor that begins a database transaction, locks the owner's application-user row first, and uses the same handle for all reads/writes.
3. Revalidate ownership, archive rules, versions, and reference types inside the locked transaction.
4. Aggregate deltas by account ID and apply atomic SQL increments with ownership predicates.
5. Define bounded transient retry and timeout behavior; rollback the complete operation on any failure.
6. Add test-only failure injection between row insertion and balance updates, never a public debug API.
7. Document the transaction-aware service API future recurring/debt/split commands will reuse.

#### Technical notes

- Never call the root database client from a helper that should participate in the command's transaction.
- Per-user locking must span account/reference mutations too; a convention only used by transfers is incomplete.
- Authenticate before acquiring locks and avoid HTTP/AWS calls while holding them.
- Serialize same-user writes at PostgreSQL, not in process memory; ALB can route concurrent calls to different API instances.
- Keep retryable database failures separate from invalid input, not-owned records, and stale-version conflicts.

#### Acceptance criteria

- [ ] Pure arithmetic covers asset and credit directions.
- [ ] Injected failure leaves rows and all balances unchanged.
- [ ] Separate connections cannot lose same-user balance updates.
- [ ] Different users do not share a global mutation lock.
- [ ] Helpers use the passed transaction handle.
- [ ] No network side effects occur inside the transaction boundary.

**Verification:** Real PostgreSQL rollback/concurrency tests plus arithmetic unit tests.  
**Learning checkpoint:** Explain atomicity, isolation, lock scope, retry boundaries, and why a read-then-write balance assignment is unsafe.

## KT-0025

### Add expense and income commands

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Feature | **Estimate:** 3 points  
**Depends on:** [KT-0024](#kt-0024)  
**Unblocks:** [KT-0026](#kt-0026)  
**Branch:** `feat/KT-0025-income-expenses`

**Story:** As a user, I want to record income and expenses with predictable account effects and owned tags.

#### Implementation tasks

1. Add discriminated DTOs for expenses and income; require exactly the appropriate source/destination leg and a matching owned user tag.
2. Reject transfer-only fee fields and client-owned/server-managed fields.
3. Invoke the command engine to persist the transaction and apply its balance delta atomically.
4. Support empty descriptions and valid past/future dates.
5. Return normalized transaction data and current version after commit.
6. Add direct/gateway authenticated tests; integrate mandatory idempotency at KT-0028 before completing the epic.

#### Technical notes

- Future dates immediately affect balances; do not enqueue or delay them.
- Credit expenses increase debt and credit income decreases it, potentially below zero for overpayment/refund workflows.
- Do not reject an expense because the balance is insufficient under the confirmed baseline.
- Test account and tag ownership independently, not only the top-level row owner.

#### Acceptance criteria

- [ ] All asset/credit income/expense signs are correct.
- [ ] Future and past entries apply immediately.
- [ ] Wrong leg/type/tag/system-tag inputs fail without side effects.
- [ ] Negative resulting balances are preserved exactly.
- [ ] Bob's account/tag cannot be referenced by Alice.

**Verification:** Numerical fixtures from section 4, public validation cases, and rollback assertions.  
**Learning checkpoint:** Explain transaction shape validation and the distinction between a user financial transaction and a database transaction.

## KT-0026

### Add transfers and paired transfer fees

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Feature | **Estimate:** 5 points  
**Depends on:** [KT-0025](#kt-0025)  
**Unblocks:** [KT-0027](#kt-0027), [KT-0029](#kt-0029)  
**Branch:** `feat/KT-0026-transfers`

**Story:** As a user, I want to transfer between accounts and record fees without partial movements or double charges.

#### Implementation tasks

1. Require distinct owned source/destination accounts; support every asset/credit direction.
2. Permit nullable tags or owned non-system tags across scopes.
3. For a positive fee, resolve the owner's system fee tag and create one derived expense child linked to the transfer.
4. Charge fee only through the child's effect; parent amount affects the transfer legs only.
5. Commit parent, child, and all balance changes in one command transaction.
6. Return the parent and fee metadata, keeping child ownership/parent linkage server-controlled.
7. Protect child rows from direct client creation/edit/deletion.

#### Technical notes

- Bank-to-card payment lowers assets and liabilities together; it is not income or an expense except for any fee.
- Credit-source fees increase debt; do not apply asset sign rules universally.
- Missing system tag is an invariant/bootstrap error: rollback rather than silently drop the fee or create an untagged child.
- Uniqueness of parent-to-child linkage provides structural backup to service logic.

#### Acceptance criteria

- [ ] Asset/asset, asset/credit, credit/asset, and credit/credit transfers match expected signs.
- [ ] Zero/negative explicit fees and same-account transfers are rejected.
- [ ] Exactly one child exists for a positive fee and none for absent fee.
- [ ] Failure after parent/child insertion rolls everything back.
- [ ] Cross-owner legs/tag/parent manipulation cannot create any rows.
- [ ] Transfer-only net-worth invariant and fee effect are tested.

**Verification:** Full direction matrix, missing-system-tag failure, and independent balance/child-row assertions.  
**Learning checkpoint:** Explain paired records, atomic multi-row effects, and why liabilities invalidate raw-balance conservation checks.

## KT-0027

### Implement edits, type conversion, fee synchronization, and deletion

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Feature | **Estimate:** 5 points  
**Depends on:** [KT-0026](#kt-0026)  
**Unblocks:** [KT-0028](#kt-0028)  
**Branch:** `feat/KT-0027-transaction-mutations`

**Story:** As a user, I want to correct or remove any-age manual transaction while keeping every affected account consistent.

#### Implementation tasks

1. Read the owned current parent/child and validate expected version under the common owner lock.
2. Normalize the complete new transaction shape before computing reversals and replacement effects.
3. Handle amount, accounts, type, tag, description, date, and fee changes.
4. Synchronize fee lifecycle: absent→positive, positive→different positive, positive→absent, transfer→non-transfer, non-transfer→transfer, and source/date changes.
5. Apply aggregated reverse-old/apply-new deltas atomically across old and new accounts.
6. Implement hard deletion of parent/child with explicit reversal exactly once.
7. Respect the recorded archived-account correction policy and reject direct derived-child writes.
8. Increment the parent version on all accepted edits; document metadata-only version changes.

#### Technical notes

- Never reverse only the parent if a fee child also affected balance.
- Parent cascading deletes do not perform money reversal without a trigger; explicit calculation must precede removal in the same transaction.
- A type change must clear fields invalid for the new type. PATCH omission and explicit null must have defined meanings.
- Account swaps can affect the same account multiple times; aggregate deltas before applying them.
- Recurring/debt-linked edit behavior is deferred until those relationships exist; do not implement fictitious linkage rules now.

#### Acceptance criteria

- [ ] Every type conversion preserves correct final balances.
- [ ] Fee add/change/remove and source/date synchronization work.
- [ ] Deleting a transfer restores parent and child effects exactly once.
- [ ] Stale versions return 409 with no side effects.
- [ ] Archived history is handled according to the recorded policy.
- [ ] Failed edits leave old rows, versions, and balances intact.

**Verification:** Port the inspected trigger-test scenarios into API tests, then add type/leg permutations, metadata-only edits, stale versions, and partial-failure injection.  
**Learning checkpoint:** Explain reversible effects, optimistic conflicts, and how transaction boundaries protect multi-account edits.

## KT-0028

### Add durable idempotency and safe replay

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Task | **Estimate:** 5 points  
**Depends on:** [KT-0027](#kt-0027)  
**Unblocks:** [KT-0030](#kt-0030)  
**Branch:** `feat/KT-0028-command-idempotency`

**Story:** As an API client, I want to retry a financial command after a timeout without posting it twice.

#### Implementation tasks

1. Require and validate bounded idempotency keys on transaction POST/PATCH/DELETE.
2. Canonicalize validated payload, operation, route identity, and expected version into a deterministic request hash.
3. Under the owner lock, look up a completed command before resource existence/version checks needed for new execution.
4. For a new key, execute the command and persist its replay response/status in the same database transaction.
5. Return original committed result for a matching replay; reject payload mismatch with 409.
6. Ensure rollback removes both effects and command marker; no permanent pending row on ordinary failure.
7. Document key scope, no automatic expiry, and the distinction between a replayed response and current resource state.
8. Add lost-response simulation and concurrent same-key requests across connections/instances.

#### Technical notes

- JSON object key order and omitted/null defaults must not create accidental hash differences after normalization.
- Replaying a successful delete must work after its resource is gone; replaying an edit must not fail merely because its version advanced.
- If the response was committed then lost, retry must retrieve it, not rerun the movement.
- Keys are owner-scoped; knowing another user's key gives no access to their replay response.
- Do not cache a JWT authentication failure as a financial command result.

#### Acceptance criteria

- [ ] Same key/request produces one effect and a stable response.
- [ ] Same key/different request returns 409.
- [ ] Concurrent retries cannot duplicate rows, fees, or deltas.
- [ ] Rollback permits a legitimate retry without stale pending state.
- [ ] Delete/edit replay bypasses obsolete existence/version checks appropriately.
- [ ] No token/credential is persisted in command records.

**Verification:** Retry after simulated committed-but-lost response, concurrent duplicates, two owners sharing a key, and changed-payload conflicts.  
**Learning checkpoint:** Explain idempotency versus uniqueness, response replay versus current reads, and why HTTP retries need database-level coordination.

## KT-0029

### Implement owned reads, filters, pagination, and basic totals

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Feature | **Estimate:** 5 points  
**Depends on:** [KT-0026](#kt-0026); final regression after KT-0028  
**Unblocks:** [KT-0030](#kt-0030)  
**Branch:** `feat/KT-0029-financial-queries`

**Story:** As a frontend developer, I want stable owned queries that preserve the current account and transaction views without loading unrelated users' data.

#### Implementation tasks

1. Implement list/detail reads with owner predicates, bounded page size, default deterministic sort, and whitelisted sort options.
2. Support account source-or-destination, group, date/range, tag, and type filters with documented AND/OR semantics.
3. Default transaction browsing to parent/standalone rows; expose fee metadata without an extra editable child entry.
4. Keep historical transactions visible when accounts are archived; filter active account lists separately.
5. Implement active account assets/liabilities/net-worth and group rollups using exact aggregate serialization.
6. Define fee-aware tag filtering: a transfer-fee tag match may return its parent once with fee-match metadata, rather than silently yielding nothing. Confirm current UI semantics in KT-0020 and document any adaptation.
7. Specify ordering/pagination behavior for equal dates and concurrent changes; use keyset pagination for the default order, with a deterministic documented alternative for other sorts if supported.
8. Add indexes based on representative query plans and bounded synthetic data, not speculative performance claims.

#### Technical notes

- Do not sum parent `fee` and child expense together in expense totals. Full budget/report endpoints remain phase 5.
- Validate filter IDs as owned references where appropriate; query joins must not leak names from another user's records.
- Whitelist sort columns/directions; never concatenate untrusted SQL fragments.
- Account/group summaries must be calculated from the same owned dataset and archive policy; avoid incoherent multiple-snapshot totals.
- Numeric aggregate results may arrive as strings/numeric types; normalize without precision loss.

#### Acceptance criteria

- [ ] Filters compose as documented and never return another user's rows/names.
- [ ] Paging is deterministic for ties and has no duplicate rows in a static dataset.
- [ ] Fee children are not independently editable/listed as normal transactions.
- [ ] Fee-tag lookup behavior is documented and tested.
- [ ] Archived history remains readable while active totals exclude archived accounts.
- [ ] Credit/negative balances and large totals serialize correctly.

**Verification:** Known two-user datasets, paging boundary tests, all filters, and query-plan inspection on local PostgreSQL.  
**Learning checkpoint:** Explain keyset pagination, join ownership, fee-aware read models, and aggregate consistency.

## KT-0030

### Add independent reconciliation and deterministic financial fixtures

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Task | **Estimate:** 3 points  
**Depends on:** [KT-0028](#kt-0028), [KT-0029](#kt-0029)  
**Unblocks:** [KT-0031](#kt-0031)  
**Branch:** `test/KT-0030-balance-reconciliation`

**Story:** As a maintainer, I want an independent way to detect inconsistent balances or fee pairs instead of trusting the same code that writes them.

#### Implementation tasks

1. Implement a local read-only reconciliation command comparing each account's stored balance to opening balance plus persisted transaction effects.
2. Include fee children once; do not add parent fee metadata again.
3. Validate fee pair cardinality, owner/type/source/date/amount/tag consistency, and absence when no fee is present.
4. Use an independent SQL/reference calculation rather than importing the production delta helper as the only oracle.
5. Run reconciliation on a consistent read snapshot or under the same owner lock to avoid false mismatches during a write.
6. Add deterministic Alice/Bob datasets through the command boundary where practical and make seed resets explicit/project-scoped.
7. Report mismatches and nonzero exit status without repairing data automatically.

#### Technical notes

- Reconciliation includes archived accounts because their stored balances still matter; active dashboard totals have different inclusion rules.
- An opening-balance baseline must remain immutable for this check to be meaningful.
- A local deliberately corrupted fixture tests the checker, not a supported manual balance-update workflow.
- Real production data import and reconciliation mapping are a later phase, not a shortcut for fixtures.

#### Acceptance criteria

- [ ] Valid create/edit/delete sequences reconcile exactly.
- [ ] Introduced balance or fee-pair corruption is detected independently.
- [ ] Running reconciliation performs no writes.
- [ ] Snapshot strategy avoids false alarms during concurrent commands.
- [ ] Fixtures are synthetic, owner-isolated, and reproducible.

**Verification:** Run the checker on valid fixtures and intentional isolated corruption, then discard the corrupted test database.  
**Learning checkpoint:** Explain independent oracles, reconciliation versus repair, and snapshot consistency.

## KT-0031

### Prove financial parity, rollback, isolation, and concurrency

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Task | **Estimate:** 5 points  
**Depends on:** [KT-0030](#kt-0030)  
**Unblocks:** [KT-0032](#kt-0032)  
**Branch:** `test/KT-0031-financial-integration`

**Story:** As a user, I want evidence that retries, concurrent actions, and failures cannot corrupt my money records or reveal another user's data.

#### Implementation tasks

1. Consolidate tests added with each feature; do not postpone or duplicate their basic coverage.
2. Port the source behavior examples and compare representative synthetic cases against local Supabase where feasible. Never use the hosted project as an oracle.
3. Use separate real PostgreSQL connections/API instances for concurrent transfers, edits/deletes, archive-vs-create, tag deletion-vs-posting, and same-key retries.
4. Inject failures after each meaningful write stage and verify full rollback plus independent reconciliation.
5. Add randomized valid command sequences with an independent model, preserving readable deterministic regression cases.
6. Test cross-owner references in every relationship and filters/aggregates, not only transaction row ownership.
7. Extend validation-only CI with strict integration dependency checks; a missing database must not silently skip the financial suite.
8. Include compiled API/gateway smoke coverage and preserve existing web/MCP/release checks.

#### Technical notes

- Use synchronization barriers to force concurrency overlap; arbitrary sleeps alone do not prove a race was exercised.
- Track expected outcomes for allowed conflicts/timeouts rather than insisting every competing command succeeds.
- Final balances must match the set of actually committed commands, not attempted commands.
- Tests must prove correctness across instances; an in-process lock can falsely pass a single-instance suite.

#### Acceptance criteria

- [ ] Arithmetic, fee lifecycle, stale versions, retries, rollback, and cross-user matrices pass.
- [ ] Every successful test sequence reconciles independently.
- [ ] Concurrent edits cannot silently overwrite each other.
- [ ] Failure/timeout paths leave no partial rows or stale idempotency state.
- [ ] CI fails when required real integration dependencies are missing.
- [ ] No secrets, tokens, or real financial records appear in artifacts/logs.

**Verification:** Run the minimum matrix below and record tested database/emulator/library versions.  
**Learning checkpoint:** Explain race reproduction, partial-failure testing, independent modeling, and why mocks cannot prove transaction isolation.

## KT-0032

### Finalize contracts, demonstrate the API, and hand off to phase 4

**Parent:** KT-E003 | **Status:** Backlog | **Type:** Task | **Estimate:** 3 points  
**Depends on:** [KT-0031](#kt-0031)  
**Unblocks:** Phase 4 frontend integration  
**Branch:** `docs/KT-0032-financial-api-handoff`

**Story:** As a frontend developer, I want a complete API contract and tested examples so I can connect existing screens without guessing financial semantics.

#### Implementation tasks

1. Update OpenAPI with all DTOs, money strings, date formats, idempotency keys, expected versions, pagination, and errors.
2. Add a mapping from existing Supabase hooks/fields to new endpoints/DTOs and note frontend bigint/formatting adaptations.
3. Document fee presentation, archive rules, type conversions, protected system tags, and unsupported time-deposit creation.
4. Provide an authenticated local API demonstration script using synthetic users and redacted output.
5. Rehearse migration/seed/smoke/test/reconciliation from a fresh local environment.
6. Summarize unresolved product decisions and phase-5 references/automation still required.
7. Update statuses only from evidence and leave production/frontend untouched.

#### Technical notes

- Generated OpenAPI must match runtime serializers and validation, especially money strings versus numbers.
- Phase 4 needs client request-key lifecycle and conflict UX; document how a retry differs from a new user action.
- A test-page demonstration is not full frontend integration or feature parity.
- Future scheduler/MCP/debt writers must reuse the command boundary and ownership model.

#### Acceptance criteria

- [ ] A new developer can perform the documented financial workflow locally.
- [ ] Endpoint schemas and actual responses agree.
- [ ] Frontend mapping identifies all deliberate compatibility changes.
- [ ] Time deposits, reporting, debt/splits, schedules, realtime, and MCP remain visibly deferred.
- [ ] Final demonstration and epic checklist have evidence or explicit blockers.
- [ ] No production deployment, import, or UI cutover has occurred.

**Verification:** Run the final demonstration using only documented commands and inspect reconciliation results.  
**Learning checkpoint:** Explain the full authenticated financial command from HTTP input to committed rows, replay response, and frontend representation.

## 7. Minimum verification matrix

| Category | Required cases |
|---|---|
| Accounts | Opening balance, immutable fields, duplicate names, credit limit, archive/unarchive, guarded deletion |
| References | Per-owner defaults, system-tag restrictions, same-name different-scope tags, foreign IDs, delete races |
| Money | Exact strings, negatives, zero/positive restrictions, overflow, large aggregate results |
| Dates | Past/future immediate effects, impossible dates, leap day, no timezone date shift |
| Basic postings | Expense/income on assets and credit, no insufficient-funds restriction |
| Transfers | All four asset/credit combinations, same-account rejection, optional tag |
| Fees | Null/add/change/remove, credit-source fee, unique child, direct-child write rejection |
| Edits | Amount/type/source/destination/date/tag changes, account swaps, metadata-only changes |
| Delete | Parent and fee reversal once, stale version, idempotent replay after row removal |
| Concurrency | Simultaneous posts, stale competing edits, edit/delete race, archive/post race |
| Idempotency | Same key/same request, different payload, lost response, rollback retry, two owners |
| Failure | Parent insertion, child insertion, account update, response-record write failures |
| Queries | Owner-filtered joins, account/group/date/tag/type combinations, deterministic pages, archived history |
| Totals | Credit signs, negative assets, archive exclusions, no fee double count |
| Reconciliation | Independent check after valid sequences and intentional corruption |

## 8. Proposed files and commands

| Location | Responsibility |
|---|---|
| `apps/api/src/finance/` | Shared money/date contracts, bootstrap, command transaction boundary |
| `apps/api/src/accounts/` | Account lifecycle and totals |
| `apps/api/src/groups/` | Owned account groups |
| `apps/api/src/tags/` | User/system tags |
| `apps/api/src/transactions/` | Financial command handlers and query service |
| `apps/api/src/database/schema/` | Drizzle tables/constraints |
| `apps/api/drizzle/` | Reviewed API-local SQL migrations |
| `apps/api/test/finance/` | Arithmetic, API, SQL, concurrency, and parity tests |
| `scripts/local/finance/` | Synthetic fixtures, smoke demo, reconciliation |
| `docs/adr/` | Financial writer, money, archive, and concurrency decisions |
| `docs/financial-api.md` | API examples and frontend mapping |

| Proposed command | Responsibility |
|---|---|
| `pnpm api:test:finance` | Fast money/DTO/delta tests |
| `pnpm api:test:finance:integration` | Real database and API financial tests |
| `pnpm local:finance:seed` | Prepare deterministic synthetic demo records |
| `pnpm local:finance:smoke` | Authenticated end-to-end financial examples |
| `pnpm local:finance:reconcile` | Read-only independent consistency check |

Reuse the existing API migration/setup commands. Commands are proposed deliverables, not currently implemented scripts. Reset only explicit disposable databases; routine seed commands must not silently clear developer history.

## 9. Final demonstration and definition of done

### Demonstration

1. Start the local environment, migrate, seed users/tags, and authenticate Alice/Bob.
2. Create Alice's cash, wallet, and credit accounts with known opening balances; show no synthetic opening transactions.
3. Record expense and income, including a future-dated transaction, and show immediate exact balance changes.
4. Transfer with a fee and show the parent/child relationship and expected balances.
5. Edit amount/source/type and add/remove a fee; show correct reversals and replacements.
6. Delete a transfer and show both effects reversed.
7. Replay a previously committed command after a simulated lost response and show no additional effect.
8. Submit a stale edit and show 409 without changes.
9. Attempt Bob-to-Alice reference/read/write operations and show rejection plus unchanged database state.
10. Archive an account and show hidden active totals but retained transaction history.
11. Run concurrent commands on separate connections/instances and demonstrate consistent committed outcomes.
12. Run reconciliation, relevant tests/builds, and the gateway smoke route.
13. List the exact phase-4 adaptations and phase-5 features not yet supported.

### Epic checklist

- [ ] KT-0020–KT-0032 acceptance criteria are complete with evidence.
- [ ] One financial writer owns balance and paired-fee effects.
- [ ] Exact money, credit signs, negative balances, and future-date behavior are preserved.
- [ ] Owner isolation applies to records, references, joins, aggregates, and replay responses.
- [ ] Atomic rollback, optimistic conflicts, and durable replay are verified against PostgreSQL.
- [ ] Independent reconciliation passes after create/edit/delete/concurrency scenarios.
- [ ] Fresh setup and documented examples work.
- [ ] OpenAPI and frontend mapping reflect runtime behavior.
- [ ] Existing production code paths and data remain unchanged.
- [ ] Deferred time-deposit/automation/reporting features are not claimed as implemented parity.

### Ticket definition of done

Acceptance criteria met; relevant tests and builds pass; technical choices documented; repository conventions followed; no real data/secrets committed; no unrelated changes; learning checkpoint explained; PR evidence records commands, results, versions, and limitations.

A blocked criterion stays blocked. Any reduced-scope completion must explicitly identify the changed requirement and linked follow-up. Do not weaken money/ownership validation or skip integration tests to obtain a green status.

## 10. Agent handoff and references

Implement one ready ticket at a time when asked. Read current repository instructions, inspect existing changes, verify predecessors, and keep the phase-2 principal contract intact. Do not create GitHub issues, modify the repository, or deploy merely because this standalone document exists.

For each PR, include ticket/epic ID, resulting behavior, technical decisions, tests run, remaining gaps, and the learning explanation. All service changes affecting money must state how atomicity, ownership, duplicate requests, and independent reconciliation were verified.

References:

- [Kwartrack specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md)
- [Transaction schema and triggers](https://github.com/jcaburnay/kwartrack/blob/main/supabase/migrations/20260424133300_transactions.sql)
- [Existing balance/fee integration tests](https://github.com/jcaburnay/kwartrack/blob/main/apps/web/src/__tests__/balanceTriggers.integration.test.ts)
- [Repository instructions](https://github.com/jcaburnay/kwartrack/blob/main/AGENTS.md)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions)

References were consulted during planning on 2026-11-06. Recheck current files and pinned tool versions during implementation. This document records recommendations and acceptance tests; it does not establish that phase 3 or its predecessor phases have already been implemented.
