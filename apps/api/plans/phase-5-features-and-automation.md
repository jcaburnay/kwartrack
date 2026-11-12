# KT-E005 — Phase 5: Remaining Features and Reliable Automation

**Project:** Kwartrack  
**Prepared:** 2026-11-09  
**Version:** 1.0  
**Status:** Planned; implementation not verified  
**Ticket range:** KT-0043–KT-0056  
**Initial estimate:** 81 story points; re-estimate after discovery  

## Objective and scope

Complete the current product’s business features on the local Nest backend: contacts, debts/splits, budget reporting, recurring transactions, time-deposit interest, overview, profile/settings, and exports. Introduce an actual local Scheduler → SQS → worker execution path while preserving the phase-3 financial writer.

Predecessors: [Phase 3](phase-3-core-financial-operations.md) and [Phase 4](phase-4-frontend-integration-and-routing.md). Backend discovery can begin earlier, but end-to-end acceptance requires the frontend integration.

### Architectural recommendations

Use a Nest worker process sharing domain services with the API. Recommend one hourly EventBridge Scheduler tick delivered to SQS; the worker scans due database schedules. Keep recurrence definitions and occurrence history in PostgreSQL rather than creating one cloud schedule per user recurring. A tick is a wake-up signal, not the authoritative list of money movements. A lost tick is caught by the next scan.

SQS delivery may repeat. Commit each occurrence with a unique business key, financial effect, remaining-count update, and next-date advancement in one transaction. Acknowledge messages only after durable work completes. Keep processing bounded so one user's backlog does not monopolize a worker. Use retry/backoff, visibility timeout, and a DLQ with an explicit replay command.

Local Scheduler/SQS compatibility must be demonstrated on the pinned emulator, including actual delivery. A manually invoked worker is useful for deterministic tests but does not substitute for this integration test. Do not add Redis/BullMQ, Kafka, Lambda, or extra databases without a specific need.

### Behavior decisions that must be resolved before coding

The specification is detailed but not fully unambiguous. KT-0043 must compare deployed migrations, current helpers, tests, and UI for these points:

- Standalone debts describe optional tracked accounts and ambiguous settlement account selection; establish whether data-only debts can later gain a ledger settlement.
- A split edit can reduce a share below an already-settled amount; choose a visible rejection or explicit overpayment rule rather than silently deleting paid money.
- Debt-settlement system tags must be handled consistently in budgets, including expense-direction settlements and orphaned settlements.
- Interest requires actual day-count, tax, rounding, partial final period, start-date, and rate-change rules; do not invent bank interest behavior from a display projection.
- Recurring creation/resume on today's date, archived accounts, timezone changes, and missed periods need precise cutoff policies.
- Deleting an app user spans PostgreSQL and Cognito; immediate atomic deletion across both systems cannot be promised.

Treat these as refinement gates, not excuses to improvise financial rules. Recommended defaults below remain proposals until the evidence/decision is recorded.

### Delivery groups

1. Behavior matrix and contacts: KT-0043–KT-0044.
2. Debt/split ledger and reports: KT-0045–KT-0048.
3. Scheduler, occurrence engine, and time deposits: KT-0049–KT-0052.
4. Dashboard, settings/export, and full demonstration: KT-0053–KT-0056.

The dependency table allows independent preparation but does not authorize parallel agents. Estimates should be refined after KT-0043; split 8-point tickets into reviewed child tasks. Proposed areas: API feature modules, worker entry point, local Terraform queues/scheduler, owned SQL migrations, web adapters, and financial integration fixtures.

## Working agreement for every ticket

These are implementation plans, not evidence that the work has been implemented. Confirm predecessor acceptance evidence in the current repository before marking a ticket Ready. IDs are planning identifiers, not GitHub issues. Keep all seven Markdown files together for relative links.

Use a branch/worktree and follow current repository instructions. Keep the hosted application and deployment configuration intact. Existing CI may deploy changes pushed to main; this plan authorizes neither merging nor deploying. Do not create issues merely because a ticket is listed here. All fixtures are synthetic unless phase 7 explicitly receives an authorized source export.

Workflow: Backlog → Ready → In progress → Review → Verified → Done; use Blocked with a reason and named dependency when necessary. Implement one coherent ticket per reviewable change; split large tickets into child tasks without renumbering existing IDs. Estimates are relative story points, not promised days. At refinement, adjust estimates and the proposed delivery groups to actual learning pace.

Definition of ready: dependencies demonstrated, behavior and DTOs agreed, existing implementation inspected, test fixture identified, uncertainties recorded. Definition of done: acceptance criteria demonstrated, relevant automated checks pass, migration and API documentation updated, local-only behavior verified, and a short learning note explains the implementation. A compatibility gap stays visible; an untested fallback cannot satisfy the original criterion.

Every PR/handoff should include: epic/ticket ID; user-visible outcome; affected contracts and migration impact; tests run with results; known limitations and follow-up IDs; learning checkpoint. Do not paste tokens, credentials, or personal financial records in evidence.

## Inherited technical contract

- NestJS with Express, Drizzle/pg, PostgreSQL via Floci RDS, Cognito via Floci, Docker Compose, and Terraform. No Better Auth or Fastify.
- Verify access tokens and derive immutable internal user IDs from the phase-2 identity mapping. Client IDs, email addresses, query parameters, and queue bodies do not establish ownership.
- Integer-centavo strings at API boundaries, PostgreSQL bigint, exact bigint domain arithmetic. Transaction calendar dates remain YYYY-MM-DD; operational timestamps are UTC. Never silently coerce exact money to floating-point numbers.
- Phase-3 financial commands are the only balance writer. Mutations acquire the app_user row lock first, validate owned references inside the transaction, and commit related changes atomically. No network calls under this lock. Workers and MCP must use the same protocol.
- Keep negative running balances, credit-account sign rules, immediate effects of future-dated manual entries, paired fee reversals, optimistic versions, and durable command idempotency. Reversal and deletion must not accidentally charge a fee twice.
- Financial history remains editable/deletable under product rules; this is not a new immutable accounting ledger. Do not introduce double-entry accounting or event sourcing as incidental migration work.
- Local emulation is evidence for this pinned setup, not proof of production AWS parity. Pin versions and record compatibility results. No deployment, DNS changes, public tunnel, or cloud provisioning is part of these phases.

## Backlog and dependencies

| Ticket | Outcome | Points | Depends on |
|---|---|---:|---|
| [KT-0043](#kt-0043) | Reconcile advanced feature behavior and freeze contracts | 5 | [KT-0032](phase-3-core-financial-operations.md#kt-0032), [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033) |
| [KT-0044](#kt-0044) | Implement contacts and advanced owned schema | 3 | [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0021](phase-3-core-financial-operations.md#kt-0021) |
| [KT-0045](#kt-0045) | Implement standalone debts and partial settlements | 8 | [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0044](phase-5-features-and-automation.md#kt-0044), [KT-0038](phase-4-frontend-integration-and-routing.md#kt-0038) |
| [KT-0046](#kt-0046) | Implement exact splits and atomic auto-ledger creation | 8 | [KT-0044](phase-5-features-and-automation.md#kt-0044), [KT-0045](phase-5-features-and-automation.md#kt-0045) |
| [KT-0047](#kt-0047) | Implement split edits, deletion, and settlement preservation | 8 | [KT-0046](phase-5-features-and-automation.md#kt-0046) |
| [KT-0048](#kt-0048) | Implement monthly budgets and personal-spend reporting | 5 | [KT-0047](phase-5-features-and-automation.md#kt-0047), [KT-0039](phase-4-frontend-integration-and-routing.md#kt-0039) |
| [KT-0049](#kt-0049) | Provision and prove Scheduler, SQS, worker, and DLQ | 5 | [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0003](phase-1-local-backend-foundation.md#kt-0003), [KT-0004](phase-1-local-backend-foundation.md#kt-0004) |
| [KT-0050](#kt-0050) | Implement recurring definitions and calendar semantics | 5 | [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0049](phase-5-features-and-automation.md#kt-0049), [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036) |
| [KT-0051](#kt-0051) | Execute recurring occurrences with durable deduplication | 8 | [KT-0050](phase-5-features-and-automation.md#kt-0050), [KT-0049](phase-5-features-and-automation.md#kt-0049), [KT-0028](phase-3-core-financial-operations.md#kt-0028) |
| [KT-0052](#kt-0052) | Complete time-deposit interest and maturity lifecycle | 8 | [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0051](phase-5-features-and-automation.md#kt-0051), [KT-0037](phase-4-frontend-integration-and-routing.md#kt-0037) |
| [KT-0053](#kt-0053) | Complete overview, upcoming items, and advanced UI integration | 5 | [KT-0048](phase-5-features-and-automation.md#kt-0048), [KT-0051](phase-5-features-and-automation.md#kt-0051), [KT-0052](phase-5-features-and-automation.md#kt-0052) |
| [KT-0054](#kt-0054) | Complete profile, theme, and recoverable account deletion | 5 | [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0051](phase-5-features-and-automation.md#kt-0051), [KT-0035](phase-4-frontend-integration-and-routing.md#kt-0035) |
| [KT-0055](#kt-0055) | Implement full owned JSON and CSV exports | 3 | [KT-0048](phase-5-features-and-automation.md#kt-0048), [KT-0052](phase-5-features-and-automation.md#kt-0052), [KT-0054](phase-5-features-and-automation.md#kt-0054) |
| [KT-0056](#kt-0056) | Verify advanced-feature parity and operational handoff | 5 | [KT-0043](phase-5-features-and-automation.md#kt-0043)–[KT-0055](phase-5-features-and-automation.md#kt-0055) |

## KT-0043

### Reconcile advanced feature behavior and freeze contracts

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0032](phase-3-core-financial-operations.md#kt-0032), [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033)

**User story / outcome:** As the implementer, I know the exact financial and calendar rules before porting advanced features.

#### Implementation tasks

- Trace current recurring jobs, debt/split RPCs, budget queries, time-deposit helpers, exports, and profile lifecycle.
- Build a specification/code/test comparison with source commit IDs.
- Resolve the ambiguity list above with concrete before/after examples and ADRs.
- Define DTOs, owned relationships, versioning, and linked-transaction mutation rules.

#### Technical notes

Current specs are a baseline, not proof of current runtime behavior. Extend phase-3 direct transaction validation to protect split/debt/interest-managed records when those features arrive. Ordinary recurring-generated transactions have looser edit/delete rules than split-generated ones. Preserve distinctions in explicit origin metadata rather than relying only on nullable FKs.

#### Acceptance criteria

- Every advanced feature has an agreed source-of-truth rule and fixture.
- Interest calculations and settlement deletion rules have no unresolved money-affecting assumptions.
- Schema migration order and public API contract are reviewable.
- Intentional deviations are identified as decisions, not called parity.

#### Verification

Review the matrix against current migrations/helpers and hand-calculate representative cases. This spike produces evidence and decisions, not speculative production code.

#### Learning checkpoint

Explain why a specification, current data, and running code can disagree and how to resolve it.


## KT-0044

### Implement contacts and advanced owned schema

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0021](phase-3-core-financial-operations.md#kt-0021)

**User story / outcome:** As a user, I can manage contacts used by debts and splits without creating orphaned references.

#### Implementation tasks

- Add people, split/participant/debt foundations, owned references, indexes, and version columns using local Drizzle migrations.
- Implement contact list/create/rename/delete and inline selection in the frontend.
- Add referential checks for accounts/tags referenced by new entities.
- Add origin fields needed by managed financial records.

#### Technical notes

People are per-user contact records, not authenticated collaborators. Do not add invitations or tenant membership. Renaming must update labels through identity-based references; deletion is blocked while referenced. All reference mutations follow the app_user lock-first protocol.

#### Acceptance criteria

- Alice cannot reference Bob’s contact, tag, or account.
- Rename propagates to historical labels without rewriting financial amounts.
- In-use deletion returns a useful conflict.
- Migration applies to a phase-3 database with existing records.

#### Verification

Migration test with seeded history, API ownership cases, and browser inline contact creation/rename.

#### Learning checkpoint

Explain FK integrity versus application ownership enforcement.


## KT-0045

### Implement standalone debts and partial settlements

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0044](phase-5-features-and-automation.md#kt-0044), [KT-0038](phase-4-frontend-integration-and-routing.md#kt-0038)

**User story / outcome:** As a user, I can track money owed or loaned and settle it in parts with correct account effects.

#### Implementation tasks

- Implement debt list/detail/create/edit/delete and exact remaining/settled amounts.
- Support agreed data-only versus tracked-account behavior.
- Model settlement events explicitly and atomically create linked income/expense via the financial command service.
- Add idempotency and optimistic version checks to debt creation, settlement, edits, and deletion; connect forms.

#### Technical notes

Loaned tracked creation is money out; repayment is money in. Owed tracked creation is money in; repayment is money out. Settlement amount must be positive and cannot exceed the agreed remaining amount. Reject direct edits/deletes of protected linked transactions. Track creation versus settlement roles so deletion does not accidentally remove unrelated history. Recheck references after acquiring the owner lock.

#### Acceptance criteria

- Two simultaneous settlements cannot overpay the same debt.
- Retrying a committed settlement creates no duplicate transaction.
- Data-only behavior matches the recorded decision.
- Deletion reverses exactly the transactions selected by the agreed lifecycle policy.

#### Verification

Real PostgreSQL tests for partial/full settlement, opposite directions, zero/overpayment, credit accounts, failure rollback, concurrency, and cross-user IDs; browser happy path.

#### Learning checkpoint

Explain an aggregate invariant spanning debt state and financial transactions.


## KT-0046

### Implement exact splits and atomic auto-ledger creation

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0044](phase-5-features-and-automation.md#kt-0044), [KT-0045](phase-5-features-and-automation.md#kt-0045)

**User story / outcome:** As a user, I can split a paid bill while keeping account cash flow and personal spending distinct.

#### Implementation tasks

- Implement equal, exact, percentage, and shares calculations with explicit integer rounding.
- Create split, participants, debts, and full-total expense in one transaction.
- Implement owned list/detail/filter and expandable split UI with URL selection.
- Reject duplicate/foreign participants and invalid allocations.

#### Technical notes

For equal splitting the payer absorbs the remainder; for PHP 100.00 among three people, two contacts owe 3333 centavos each and the payer owes 3334. Specify exact/percentage/shares rounding in KT-0043; calculated shares plus payer share must equal total. Account cash decreases by the full expense, while budgets later count the payer share. This distinction cannot be implemented by reducing the stored expense.

#### Acceptance criteria

- Allocations always sum exactly to total.
- One split produces exactly one managed full-total expense and one debt per external participant.
- Failure anywhere leaves no partial split or balance effect.
- Retry uses the same durable command result.

#### Verification

Golden fixtures across all methods, indivisible cents, zero/invalid weights, maximum supported amounts, foreign references, and injected transaction failure.

#### Learning checkpoint

Explain why cash-flow accounting differs from personal budget consumption.


## KT-0047

### Implement split edits, deletion, and settlement preservation

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0046](phase-5-features-and-automation.md#kt-0046)

**User story / outcome:** As a user, I can correct a split without losing payments that already occurred.

#### Implementation tasks

- Preserve settled amounts for retained participants, add new participant debts, and apply the agreed overpaid-share rule.
- Update the managed expense through reverse-old/apply-new financial commands.
- On removal/deletion, preserve applicable settlement transactions and retag them as orphan settlements.
- Extend account/tag/contact deletion guards and implement frontend confirmation/conflict handling.

#### Technical notes

Deleting a split removes its full expense and reverses that expense, but retained repayment income still affects balances. Clear obsolete links, keep origin metadata, and apply the debt-settlement-orphan system code. Do not rely on ON DELETE CASCADE to reverse money. All rows and balance effects belong in one owner-locked transaction. Changing a split tag updates inherited debt categorization according to the contract.

#### Acceptance criteria

- Removing a partially settled participant retains the actual repayment.
- Deleting a split reverses only its deleted expense while preserving settlement money.
- Direct transaction mutation cannot bypass managed-record rules.
- Concurrent edit/settle cannot lose paid amounts.

#### Verification

Before/after reconciliation for edits, payer account changes, participant removal, full deletion, stale versions, and simultaneous settlement. Verify both transaction count and balances.

#### Learning checkpoint

Explain why referential cascades alone cannot preserve business accounting rules.


## KT-0048

### Implement monthly budgets and personal-spend reporting

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0047](phase-5-features-and-automation.md#kt-0047), [KT-0039](phase-4-frontend-integration-and-routing.md#kt-0039)

**User story / outcome:** As a user, I can set monthly caps and see personal spending without counting other people’s shares as mine.

#### Implementation tasks

- Add monthly overall caps and per-tag allocations with atomic validation.
- Implement copy-from-most-recent-prior-month as an editable draft action.
- Build expense reporting, split-share adjustment, agreed system-tag exclusions, and Others grouping.
- Connect month picker, progress, drilldowns, and navigation warnings.

#### Technical notes

Sum of allocations must not exceed overall cap. Budgets do not reject actual spending. No rollover or income budgeting is introduced. Use stored transaction dates for calendar-month membership; timezone changes do not rewrite past dates. Apply expense-direction settlement exclusions explicitly rather than assuming all repayments are income. Guard percentages when the cap is zero. Retain exact amounts outside chart display conversion.

#### Acceptance criteria

- April edits do not alter March’s configuration.
- A 480000-centavo dinner with 384000 owed by contacts contributes 96000 personal spend.
- Transfer principal is excluded, fee expense follows its rule, and settlements follow the signed decision.
- Others plus allocated-category actuals equals overall actual.

#### Verification

Golden multi-month fixtures with splits, fees, settlements, deleted splits, unallocated/system tags, archived accounts, zero caps, and allocation races. Browser drilldown agrees with totals.

#### Learning checkpoint

Explain reporting semantics versus balance effects and why category labels alone are insufficient.


## KT-0049

### Provision and prove Scheduler, SQS, worker, and DLQ

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0003](phase-1-local-backend-foundation.md#kt-0003), [KT-0004](phase-1-local-backend-foundation.md#kt-0004)

**User story / outcome:** As a developer, I can run local background work through AWS-style services and inspect failures.

#### Implementation tasks

- Provision hourly scheduler tick, work queue, dead-letter queue, and necessary local role configuration through Terraform.
- Add a Nest worker entry point with explicit local endpoints, bounded polling, graceful shutdown, and readiness.
- Validate tick envelopes and implement retry/visibility/acknowledgment behavior.
- Provide queue inspection and controlled DLQ replay commands.

#### Technical notes

Scheduler target delivery retries and consumer processing retries are different layers. Verify the actual pinned emulator behavior for each. Set visibility above normal processing duration or extend it; shutdown must stop receiving and either finish or leave work retryable. Queue bodies do not authorize arbitrary user commands. A tick may scan owned schedules via trusted worker service methods, not a public unguarded admin HTTP endpoint.

#### Acceptance criteria

- An actual scheduled local tick reaches SQS and is consumed.
- A failed item is redelivered and eventually reaches the configured failure path.
- Worker restart loses no committed work and acknowledges no uncommitted work.
- All SDK endpoints remain local.

#### Verification

Live short-interval test schedule, receive/process/delete traces, forced failure, visibility expiration, DLQ inspection, and shutdown during processing. Restore hourly dev schedule after test.

#### Learning checkpoint

Explain at-least-once delivery, visibility timeout, and the difference between queue acknowledgment and business commit.


## KT-0050

### Implement recurring definitions and calendar semantics

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0049](phase-5-features-and-automation.md#kt-0049), [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036)

**User story / outcome:** As a user, I can configure recurring income, expense, or transfers with predictable calendar dates.

#### Implementation tasks

- Add recurring definition CRUD, pause/resume/completion fields, reference validation, and UI filters.
- Implement anchored weekly/monthly/quarterly/semiannual/annual date computation.
- Persist next occurrence UTC moment plus sufficient anchor/timezone information.
- Define profile-timezone changes and archived-account handling per KT-0043.

#### Technical notes

Jan 31 clamps in February and returns to Mar 31. Creation with a past anchor skips historical dates; downtime catchup is different. Pause retains definition and resume computes forward without a pause-period burst. Editing monetary fields affects future occurrences only. Remaining count must be a positive integer or null; zero is reserved for completion. Use an injected clock and an IANA-zone-aware calendar library with pinned version.

#### Acceptance criteria

- Anchor and DST tests produce the intended local date.
- Past-anchor creation makes no historical transactions.
- Resume skips the paused interval.
- Foreign/archived references fail according to the recorded policy; unsupported cadence values fail validation.

#### Verification

Pure calendar tests including leap day, Jan 31, timezone change, today cutoff, pause/resume, and installment reset; browser create/edit/pause.

#### Learning checkpoint

Explain calendar recurrence versus adding a fixed number of milliseconds.


## KT-0051

### Execute recurring occurrences with durable deduplication

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0050](phase-5-features-and-automation.md#kt-0050), [KT-0049](phase-5-features-and-automation.md#kt-0049), [KT-0028](phase-3-core-financial-operations.md#kt-0028)

**User story / outcome:** As a user, scheduled entries appear once even if jobs retry or my development computer was asleep.

#### Implementation tasks

- Add an occurrence journal with a unique schedule identity and scheduled occurrence key.
- In one transaction acquire owner lock, reread active definition, check occurrence, create financial movement, advance schedule, and update installment count.
- Process missed dates in bounded batches in chronological order.
- Add operational status for blocked references and a safe replay path.

#### Technical notes

Deduplicate by business occurrence, not SQS message ID. Keep durable occurrence identity after a user deletes its generated transaction so retries do not resurrect it. Schedule edits must retain journal history; define generation/version handling without accidentally reposting the same business occurrence. Do not decrement count for a failed posting. Separate workers use the same database lock protocol as manual API mutations.

#### Acceptance criteria

- Concurrent workers and repeated ticks create one effect per occurrence.
- Crash after commit/before SQS delete results in harmless replay.
- Downtime catches up due occurrences with original dates, up to remaining count.
- Completed/paused/deleted schedules never fire again improperly.
- Deleting a generated transaction does not cause automatic recreation.

#### Verification

Integration tests using separate connections/processes, time-controlled catchup, transfer fees, credit accounts, explicit crash points, and a deleted occurrence. Reconcile balances afterward.

#### Learning checkpoint

Explain why effectively-once financial effects require durable keys even when transport is at least once.


## KT-0052

### Complete time-deposit interest and maturity lifecycle

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0051](phase-5-features-and-automation.md#kt-0051), [KT-0037](phase-4-frontend-integration-and-routing.md#kt-0037)

**User story / outcome:** As a user, I can create a time deposit whose posted interest is traceable and whose maturity stops future accrual.

#### Implementation tasks

- Add time-deposit metadata and owned linked schedule creation atomically.
- Implement the verified simple-interest formula, precise rounding, partial-period logic, and rate-change policy.
- Post interest through the occurrence/financial engine, including at-maturity cadence.
- Process final interest and matured state in a defined order; connect account forms/detail display.

#### Technical notes

Use the current implementation’s verified interest rules, not a guessed annual-rate/12 formula. Persist the calculation inputs needed to explain each posting. Historical posted interest must not change on rate edits. Duplicate maturity jobs must not omit or repeat final interest. Principal/opening balance remains immutable. A maturity extension needs an explicit state transition rule, including whether a previously matured schedule resumes. No compounding, tax assumptions, or withdrawal penalty engine is added without an approved behavior decision.

#### Acceptance criteria

- All supported posting cadences reconcile to hand-calculated fixtures.
- At-maturity posts once; maturity does not suppress unpaid final interest.
- Missed periods, edits, and restarts preserve the agreed accrual result.
- Deletion/archive rules prevent orphan schedules; retained balance can be transferred after maturity.

#### Verification

Golden fixtures from existing helpers plus independently calculated examples, partial final period, leap year, rate edit, extension, two-worker race, and rollback after interest creation.

#### Learning checkpoint

Explain the difference between estimated maturity value, accrued calculation, and actual posted money.


## KT-0053

### Complete overview, upcoming items, and advanced UI integration

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0048](phase-5-features-and-automation.md#kt-0048), [KT-0051](phase-5-features-and-automation.md#kt-0051), [KT-0052](phase-5-features-and-automation.md#kt-0052)

**User story / outcome:** As a user, I can use all financial screens and the dashboard without unavailable placeholders.

#### Implementation tasks

- Implement overview aggregates, rolling 12-month spend trend, budget progress, and upcoming queries.
- Integrate recurring, debts/splits, time-deposit, and budget capabilities into navigation/FAB.
- Preserve urgency ordering and drilldowns.
- Define cache invalidation dependencies for every new mutation and worker result.

#### Technical notes

Overview remains a right-now dashboard. Specify whether spend trend uses personal-share or full cash-flow semantics by matching the agreed baseline; do not assume it equals budget actual. Upcoming combines next-seven-day recurrings, unsettled loaned debts older than 14 days, and budget warnings. Use profile timezone for today and bound lists without losing correct aggregate totals.

#### Acceptance criteria

- Overview numbers match the same underlying API/report rules used by detail screens.
- Worker-created records become visible on refetch before phase-6 realtime exists.
- Empty/new-user state does not imply failed queries returned zero.
- All previously deferred financial capability states are enabled only after working endpoints exist.

#### Verification

Cross-screen fixtures, month/timezone boundaries, urgency ordering, zero-data/error states, and a browser journey covering each financial feature.

#### Learning checkpoint

Explain how a read model composes several domains without duplicating financial logic.


## KT-0054

### Complete profile, theme, and recoverable account deletion

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043), [KT-0051](phase-5-features-and-automation.md#kt-0051), [KT-0035](phase-4-frontend-integration-and-routing.md#kt-0035)

**User story / outcome:** As a user, I can manage my preferences and delete my local test account without leaving active background jobs.

#### Implementation tasks

- Implement display name, theme, and validated timezone updates; adapt password/email actions to proven Cognito capabilities.
- Define future schedule recalculation on timezone change without redating history.
- Implement authenticated deletion intent with user confirmation and immediate app-level access block.
- Coordinate database cleanup and Cognito deletion through a durable, retryable deletion workflow.

#### Technical notes

PostgreSQL and Cognito do not share a transaction. Persist deletion state before external calls; mark identity disabled so existing JWTs cannot recreate the user or continue jobs. Retain only the minimal tombstone/status needed for safe retry, with a documented cleanup policy. Worker selection and identity resolution must honor deletion state. This is an explicit implementation adaptation to the spec’s immediate deletion wording.

#### Acceptance criteria

- Preference changes survive reload and affect future behavior only.
- Password/email controls invoke supported flows or state the local limitation.
- Confirmed deletion immediately blocks reads/writes/jobs.
- A Cognito outage leaves a visible retryable state and cannot resurrect the app account.

#### Verification

Two-system failure injection before/after each step, stale JWT request, pending job, retry, and final owned-row cleanup. Use disposable local identities only.

#### Learning checkpoint

Explain a recoverable cross-system workflow and why it differs from one SQL transaction.


## KT-0055

### Implement full owned JSON and CSV exports

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0048](phase-5-features-and-automation.md#kt-0048), [KT-0052](phase-5-features-and-automation.md#kt-0052), [KT-0054](phase-5-features-and-automation.md#kt-0054)

**User story / outcome:** As a user, I can download complete historical data with exact amounts and stable relationships.

#### Implementation tasks

- Export all owned entities, including archived accounts, completed recurring definitions, and settled debts.
- Add versioned JSON schema and per-entity CSV formats with documented money/date representation.
- Use one consistent database snapshot for multi-table exports.
- Wire browser downloads and restrict export endpoints to the verified owner.

#### Technical notes

Use centavo strings in the new JSON format and explicitly document the difference from older numeric exports. Exports omit tokens, credentials, internal queue secrets, and other users. Preserve relationship IDs. Define spreadsheet formula handling for untrusted text cells in CSV while preserving raw values in JSON. This is a readable backup, not the phase-7 importer; do not promise round-trip support automatically.

#### Acceptance criteria

- Export includes complete history across multiple pages and related entities.
- Exact money survives parsing with the documented schema.
- Concurrent writes do not create a broken cross-table snapshot.
- Foreign-user records and authentication secrets never appear.

#### Verification

Golden export fixture with relationships, unsafe CSV text, large centavo values, archived/settled records, and writes during export; browser download check.

#### Learning checkpoint

Explain snapshot consistency and the difference between export format and migration protocol.


## KT-0056

### Verify advanced-feature parity and operational handoff

**Parent:** KT-E005 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0043](phase-5-features-and-automation.md#kt-0043)–[KT-0055](phase-5-features-and-automation.md#kt-0055)

**User story / outcome:** As the next implementer, I can reproduce the full local financial workflow and diagnose automation failures.

#### Implementation tasks

- Consolidate two-user API/browser tests and independent reconciliation across managed transaction types.
- Demonstrate real Scheduler/SQS delivery, worker crash recovery, DLQ replay, and time-deposit maturity.
- Publish the feature matrix with accepted deviations and local auth limitations.
- Document commands, queue metrics, failure handling, and phase-6 event hooks.

#### Technical notes

Run clean migrations and upgrade migrations from a populated phase-3 database. Keep diagnostic logs free of financial descriptions and tokens. State separate health for API, database, worker heartbeat, oldest due schedule, and queue backlog. A healthy web process does not mean recurring automation is working.

#### Acceptance criteria

- Every advanced feature has evidence or an explicitly blocked criterion.
- No duplicate posting after retry/restart; reconciliation passes.
- Browser financial workflows operate through the intended local route.
- The next agent can identify every command that phase 6 must emit events for.

#### Verification

Focused unit/integration/browser suites, lint/typecheck/build, fresh-stack demo, and crash/replay verification with redacted evidence.

#### Learning checkpoint

Explain the most significant money invariant, scheduling tradeoff, and emulator limitation discovered.

## Epic acceptance and handoff

Exit demonstration: create contacts; record a split; settle it partially; edit and delete while preserving repayment; inspect budget personal spend; create a recurring transfer with fee; deliver duplicate ticks; pause/resume; mature a time deposit; inspect overview; export all data; delete a disposable user with an injected Cognito failure and recover.

Exit requires KT-0043–KT-0056, a resolved behavior matrix, clean balance reconciliation, actual queue/scheduler evidence, and a complete capability map. Handoff to [Phase 6](phase-6-realtime-and-mcp.md) includes the list of mutation entry points, durable occurrence identities, deletion state checks, and cache invalidation dependencies. Unresolved money rules block parity rather than being hidden in a future phase.

## References and evidence limits

- [Kwartrack specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md), inspected 2026-11-09; blob d46cf360fec0d3fa840c8561dae01a0c244baf70. Current migrations and helpers must be checked in KT-0043.
- [Floci Scheduler](https://floci.io/floci/services/scheduler/), consulted 2026-11-09; advertised support still requires pinned-version execution tests.
- [AWS SQS at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html): consumers must tolerate duplicate delivery.

These references inform the design; they do not establish that any feature in this epic has been implemented.
