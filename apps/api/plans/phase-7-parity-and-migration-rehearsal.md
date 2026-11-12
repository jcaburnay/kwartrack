# KT-E007 — Phase 7: Parity Verification and Local Migration Rehearsal

**Project:** Kwartrack  
**Prepared:** 2026-11-09  
**Version:** 1.0  
**Status:** Planned; implementation not verified  
**Ticket range:** KT-0067–KT-0076  
**Initial estimate:** 54 story points; re-estimate after discovery  

## Objective and completion decision

Establish whether the new local backend is a credible replacement candidate by verifying functional parity, importing a representative snapshot into an isolated target, reconciling every financial relationship, and rehearsing recovery. Finish with an evidence-backed recommendation and an explicit decision checkpoint. Do not deploy, switch production traffic, retire Supabase, change DNS, or replace the hosted MCP connector.

Predecessors: [Phase 5](phase-5-features-and-automation.md) and [Phase 6](phase-6-realtime-and-mcp.md), plus all earlier epic acceptance evidence. A realistic migration test needs the complete schema and managed-transaction rules.

### Scope and source data boundary

Start with synthetic source-shaped fixtures. An actual personal-data rehearsal is optional and requires an explicitly supplied/authorized export or read-only extraction scope. This planning request authorizes creating plans, not reading/exporting the user’s financial records. Synthetic rehearsal can establish mechanics; if real-data rehearsal is not performed, the final decision must state that limitation rather than claim real-data readiness.

Use the current Supabase-based implementation as source. The archived SpacetimeDB/Clerk version is not part of this migration. Existing app JSON export is documented as a readable backup, not a supported round-trip importer. Inspect whether it contains enough fields for this migration; if not, use a purpose-built read-only snapshot/export process with a versioned manifest.

### Recommended migration strategy

1. Take a consistent source snapshot with schema/version metadata and checksums. Never extract tables independently while source data is changing and call it a consistent snapshot.
2. Load raw values into isolated staging with exact decimal parsing, a source-to-target identity map, stable source IDs, and no active schedules or event consumers.
3. Validate money, dates, foreign keys, ownership, origins, fee pairs, and schedule state. Reject/quarantine discrepancies with row identifiers and reasons; do not silently coerce or repair them.
4. Import in dependency order with a dedicated migration path. Do not invoke live transaction commands that would apply historical balance effects twice.
5. Reconcile source snapshot balances to target balances and independently reconstruct opening + transaction effects. Both comparisons must pass or produce an explicitly reviewed discrepancy.
6. Rehearse restart/rerun, snapshot restore, and controlled activation of cloned schedules. Keep the original application untouched.

For this local app, prefer a fresh isolated target database per rehearsal over a complex incremental sync pipeline. Use import-run state and checkpoints to make interruption diagnosable. A later production cutover would need its own final snapshot/freeze/delta strategy; it is not implied here.

### Critical migration rules

| Area | Required treatment |
|---|---|
| Identity | Map source user ID to internal app_user UUID explicitly; link to a local Cognito issuer/subject through an explicit mapping, never email-only matching |
| Passwords/sessions | Do not import password hashes or bearer tokens; create local test identities separately |
| IDs | Preserve stable source IDs where safe or maintain a total mapping; rewrite all FKs consistently |
| Money | Preserve exact integer centavos; reject already-rounded unsafe numeric inputs |
| Balance import | Load opening/current balances and history with live financial effects disabled; independently reconcile afterward |
| Fees | Preserve one parent/child pair and existing historical signs; do not regenerate fees on import |
| Managed transactions | Preserve split/debt/recurring origin and lifecycle links; do not treat every row as manually editable |
| Schedules | Freeze during load; preserve historical execution state and checkpoint so import cannot replay already-posted occurrences |
| Timezone/dates | Preserve stored calendar dates and timezone metadata; no UTC reformatting that moves dates |
| Workers/outbox | Import produces no live notifications or scheduled money movements; enable only after validation and a recorded activation policy |
| Diagnostics | Keep sensitive row details in local restricted artifacts; reports use counts/IDs/redacted examples |

### Delivery groups

1. Parity and import contracts: KT-0067–KT-0069.
2. Isolated import and reconciliation: KT-0070–KT-0071.
3. Recovery and runtime verification: KT-0072–KT-0074.
4. Operational review and final decision: KT-0075–KT-0076.

Proposed areas: standalone local migration tooling, source/target adapters, versioned fixture manifests, integration/differential tests, operational runbooks, and a readiness report. These tools are not exposed as public application endpoints.

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
| [KT-0067](#kt-0067) | Build the full feature parity and evidence matrix | 5 | [KT-0056](phase-5-features-and-automation.md#kt-0056), [KT-0066](phase-6-realtime-and-mcp.md#kt-0066) |
| [KT-0068](#kt-0068) | Define export manifest and exact source validation | 5 | [KT-0067](phase-7-parity-and-migration-rehearsal.md#kt-0067), [KT-0055](phase-5-features-and-automation.md#kt-0055) |
| [KT-0069](#kt-0069) | Implement identity mapping and import transformation rules | 5 | [KT-0068](phase-7-parity-and-migration-rehearsal.md#kt-0068), [KT-0013](phase-2-authentication-and-ownership.md#kt-0013), [KT-0043](phase-5-features-and-automation.md#kt-0043) |
| [KT-0070](#kt-0070) | Build the isolated importer and resumable run ledger | 8 | [KT-0069](phase-7-parity-and-migration-rehearsal.md#kt-0069) |
| [KT-0071](#kt-0071) | Reconcile balances, relationships, and reports independently | 8 | [KT-0070](phase-7-parity-and-migration-rehearsal.md#kt-0070), [KT-0030](phase-3-core-financial-operations.md#kt-0030), [KT-0048](phase-5-features-and-automation.md#kt-0048) |
| [KT-0072](#kt-0072) | Rehearse snapshot restore and rollback of the local experiment | 5 | [KT-0071](phase-7-parity-and-migration-rehearsal.md#kt-0071) |
| [KT-0073](#kt-0073) | Run deterministic differential and full-browser workflows | 5 | [KT-0071](phase-7-parity-and-migration-rehearsal.md#kt-0071), [KT-0067](phase-7-parity-and-migration-rehearsal.md#kt-0067) |
| [KT-0074](#kt-0074) | Test concurrency, downtime, and measured local capacity | 5 | [KT-0072](phase-7-parity-and-migration-rehearsal.md#kt-0072), [KT-0073](phase-7-parity-and-migration-rehearsal.md#kt-0073) |
| [KT-0075](#kt-0075) | Finish operational, security, and compatibility review | 5 | [KT-0074](phase-7-parity-and-migration-rehearsal.md#kt-0074), [KT-0066](phase-6-realtime-and-mcp.md#kt-0066) |
| [KT-0076](#kt-0076) | Publish readiness report and replacement decision checkpoint | 3 | [KT-0067](phase-7-parity-and-migration-rehearsal.md#kt-0067)–[KT-0075](phase-7-parity-and-migration-rehearsal.md#kt-0075) |

## KT-0067

### Build the full feature parity and evidence matrix

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0056](phase-5-features-and-automation.md#kt-0056), [KT-0066](phase-6-realtime-and-mcp.md#kt-0066)

**User story / outcome:** As the project owner, I can see which current behaviors are preserved, changed intentionally, or still missing.

#### Implementation tasks

- Inventory all current routes, forms, RPCs/jobs, financial rules, auth flows, export behavior, and MCP tools.
- Map each to a target implementation, ticket, test, and observed result.
- Separate required local parity from explicit future features and production-only work.
- Record source commit, target commit, migration versions, emulator version, and configuration fingerprint.

#### Technical notes

Neither a checklist tick nor a green unit suite proves full parity. Include deletion/archive semantics, fees, credit signs, negative balances, future dates, monthly split budgets, recurring catchup, interest maturity, and identity isolation. Flag intentional differences such as new money-string DTOs, auth UX limitations, and staged cross-system account deletion.

#### Acceptance criteria

- Every current feature has a classified status and evidence link.
- No unimplemented feature is silently labeled out of scope.
- Accepted deviations are distinct from failures and deferred product features.
- The list explicitly excludes archived legacy implementation features.

#### Verification

Review against current specs/code and earlier epic handoffs; replay a representative workflow per domain.

#### Learning checkpoint

Explain parity of user behavior versus equality of implementation details.


## KT-0068

### Define export manifest and exact source validation

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0067](phase-7-parity-and-migration-rehearsal.md#kt-0067), [KT-0055](phase-5-features-and-automation.md#kt-0055)

**User story / outcome:** As a migration operator, I can tell whether a source dataset is complete, consistent, and safe to import.

#### Implementation tasks

- Define manifest version, source schema/commit, export timestamp/snapshot identifier, table counts, hashes, owner scope, and money/date encodings.
- Implement source-shaped synthetic fixtures and a read-only extraction design.
- Validate UTF-8/JSON/CSV structure, duplicate IDs, numeric precision, required columns, and consistent references.
- Document a narrowly scoped procedure for an optional user-authorized real snapshot.

#### Technical notes

Do not rely on plain JSON.parse of numeric bigint fields if the parser can round them before validation. Prefer textual integer export from SQL or a lossless parser. A hash proves bytes match, not that all tables belong to one snapshot. Source account balance changes during extraction require transactional snapshot isolation or an explicit quiescence method. Exclude auth secrets and irrelevant provider internals.

#### Acceptance criteria

- Incomplete table sets, broken hashes, unsafe numeric values, and schema mismatches fail with useful diagnostics.
- Synthetic fixture can exercise every entity and origin type.
- Export procedure is read-only and scoped to the intended owner.
- Actual personal data is not accessed merely to complete this ticket.

#### Verification

Fixture corruption tests, huge centavo values, malformed dates, duplicate IDs, inconsistent snapshot metadata, and incomplete relationship sets.

#### Learning checkpoint

Explain snapshot consistency, checksums, and lossless numeric ingestion.


## KT-0069

### Implement identity mapping and import transformation rules

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0068](phase-7-parity-and-migration-rehearsal.md#kt-0068), [KT-0013](phase-2-authentication-and-ownership.md#kt-0013), [KT-0043](phase-5-features-and-automation.md#kt-0043)

**User story / outcome:** As a migration operator, I can transform a source graph into the target schema without changing its ownership or meaning.

#### Implementation tasks

- Create explicit source-owner → internal-user → local-Cognito mapping records.
- Define source-to-target ID mappings and transformations for all entity/foreign-key types.
- Preserve system-tag codes, transaction origin, fee parentage, settlement roles, and recurring occurrence evidence.
- Produce a dry-run transformation report without writing financial rows.

#### Technical notes

Never infer identity solely from matching email or display name. Recreating a local Cognito pool changes subjects; require an explicit rebind/mapping procedure. Missing historical occurrence IDs need a migration checkpoint policy based on source nextOccurrenceAt and existing generated transactions. If history cannot prove whether a due period already posted, quarantine that schedule until reviewed; do not guess.

#### Acceptance criteria

- Every imported reference resolves to the intended owned entity.
- System tags are mapped without duplicate bootstrap inserts.
- Ambiguous recurrence or managed-record origins block activation.
- Dry run reports counts, mappings, exclusions, and discrepancies with no target financial mutation.

#### Verification

Fixtures with renamed tags, duplicate contact names, two owners, deleted parents/orphan settlements, restarted pools, and incomplete recurring history.

#### Learning checkpoint

Explain why identity migration is an explicit mapping problem rather than an email lookup.


## KT-0070

### Build the isolated importer and resumable run ledger

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0069](phase-7-parity-and-migration-rehearsal.md#kt-0069)

**User story / outcome:** As a developer, I can import a snapshot into a disposable local database and safely rerun after interruption.

#### Implementation tasks

- Require an explicit local target allowlist/marker and a manifest checksum before import.
- Keep worker, scheduler processing, outbox publication, and external mutation entry points disabled for the target.
- Stage raw data, validate transformations, then load in FK dependency order using transactional batches and run checkpoints.
- Implement dry-run, status, resume, and discard-run operations with documented bounds.

#### Technical notes

This is a privileged local migration adapter, not the normal financial command API. Import stored balances/history without invoking mutation triggers or generating fresh paired fees. Do not globally disable constraints on a shared database; validate staging and use an isolated target with the intended schema. Resume must verify manifest/checkpoint identity and avoid partially repeating a batch. Unknown outcomes require inspecting run state before retry, not assuming failure.

#### Acceptance criteria

- A fresh import produces expected row counts and links with zero scheduled executions.
- Restart at each batch boundary resumes or fails safely without duplicate rows.
- A different manifest cannot resume an existing run.
- Source is untouched; wrong/nonlocal target configuration is rejected.

#### Verification

End-to-end synthetic import, interruption before/after batch commit, retry, invalid FK, duplicate run, and target guard tests.

#### Learning checkpoint

Explain why historical import must bypass live posting effects while retaining integrity checks.


## KT-0071

### Reconcile balances, relationships, and reports independently

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 8 points  
**Depends on:** [KT-0070](phase-7-parity-and-migration-rehearsal.md#kt-0070), [KT-0030](phase-3-core-financial-operations.md#kt-0030), [KT-0048](phase-5-features-and-automation.md#kt-0048)

**User story / outcome:** As the project owner, I can verify that imported data represents the same money and obligations.

#### Implementation tasks

- Compare source-snapshot and target balances/counts per account and entity.
- Independently reconstruct account balances from opening balance and transaction deltas with credit signs and fee children.
- Verify debt settled/remaining amounts, split allocations, budget actuals, recurring state, and time-deposit postings.
- Generate a machine-readable discrepancy report and human summary.

#### Technical notes

Do not compare two reports computed by the same new helper and call that independent verification. Use source observations plus separately implemented reconciliation formulas/golden expectations. If historical opening balance cannot be derived reliably, report the limitation; do not silently choose an opening value that forces equality. Include archived accounts in balance verification even though active UI totals exclude them. No rounding tolerance is allowed for integer centavos.

#### Acceptance criteria

- All expected values match exactly or every discrepancy is classified and reviewed.
- Parent/child fee and managed-record relationships are complete and nonduplicated.
- Net worth applies credit sign and archive rules consistently.
- Reconciliation is read-only and never repairs data automatically.

#### Verification

Known-good dataset plus deliberately corrupted balance, fee, share, settlement, and schedule fixtures; confirm each corruption is detected.

#### Learning checkpoint

Explain why matching row counts and aggregate totals can still hide incorrect individual balances.


## KT-0072

### Rehearse snapshot restore and rollback of the local experiment

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0071](phase-7-parity-and-migration-rehearsal.md#kt-0071)

**User story / outcome:** As a developer, I can recover a known-good local dataset after a failed migration or schema change.

#### Implementation tasks

- Create a restorable target PostgreSQL backup and record required schema/configuration/identity metadata.
- Restore into a separate disposable database and repeat reconciliation.
- Test discard-and-rebuild of an incomplete import and recovery to the prior target snapshot.
- Document selection of the existing hosted frontend as an unchanged fallback without synchronizing test writes into it.

#### Technical notes

A DB backup alone does not restore Cognito users, queue contents, or Terraform state. Define which resources are recreated and which identities are explicitly rebound. Keep jobs disabled throughout restore; reconcile occurrence state before activation. Do not execute destructive rollback against the source. Local test writes may be discarded; this does not establish a production rollback strategy after real writes on a new backend.

#### Acceptance criteria

- Restore works from documented inputs on a clean target.
- Financial checks and identity ownership pass after restore.
- Pending source/target jobs cannot replay money unexpectedly.
- Runbook clearly separates local rollback from future production cutover rollback.

#### Verification

Actual backup/restore drill, missing dependency case, local identity rebind, and fresh reconciliation report.

#### Learning checkpoint

Explain recovery point, restore dependencies, and why backups need a tested restoration path.


## KT-0073

### Run deterministic differential and full-browser workflows

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0071](phase-7-parity-and-migration-rehearsal.md#kt-0071), [KT-0067](phase-7-parity-and-migration-rehearsal.md#kt-0067)

**User story / outcome:** As a user, I can trust that equivalent workflows produce equivalent outcomes on source-shaped and target systems.

#### Implementation tasks

- Define deterministic action scripts covering every domain and all current MCP tools.
- Run against synthetic current-system fixtures/reference behavior and target APIs.
- Compare normalized semantic results while allowing intended DTO/auth differences.
- Exercise the same target workflows in the browser through gateway/ALB and local MCP client.

#### Technical notes

Do not execute writes against hosted personal data to perform a comparison. Use isolated source fixtures or recorded golden outcomes where the source cannot be run locally; label weaker evidence explicitly. Normalize IDs/timestamps only when they are irrelevant; preserve ordering, exact dates, amounts, and relationship meaning. Every accepted behavior change needs an explicit expectation, not a broad snapshot update.

#### Acceptance criteria

- Expense/transfer/edit/delete, split/debt/settlement, budget, recurrence, maturity, export, auth, and realtime journeys pass.
- Cross-user denial is covered across HTTP, socket, worker selection, and MCP.
- Intentional differences are visible in the comparison report.
- All deterministic fixtures reconcile after each workflow.

#### Verification

Differential API suite, browser suite, MCP protocol suite, and golden report comparisons using a fixed clock.

#### Learning checkpoint

Explain semantic comparison and how normalization can accidentally hide a defect.


## KT-0074

### Test concurrency, downtime, and measured local capacity

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0072](phase-7-parity-and-migration-rehearsal.md#kt-0072), [KT-0073](phase-7-parity-and-migration-rehearsal.md#kt-0073)

**User story / outcome:** As a local operator, I know the system’s failure behavior and whether it fits my development hardware.

#### Implementation tasks

- Exercise concurrent web/MCP/worker mutations for one and multiple owners.
- Inject database outage, process kill, queue duplication, delayed ticks, and lost responses.
- Measure startup time, idle RAM/CPU, database connections, representative request latency, and backlog recovery.
- Rehearse controlled activation of imported schedules using a documented clock/checkpoint policy.

#### Technical notes

Use a bounded representative workload; this is not a production load certification. Proposed local targets should be agreed after measuring the Mac/PC environment rather than inventing service-level guarantees. Re-enable imported automation only after deciding the catchup cutoff and reviewing pending occurrences. The original hosted automation may still run independently; the local copy must never be treated as a synchronized replacement.

#### Acceptance criteria

- No duplicate or lost financial effect across tested failure points.
- Same-user contention remains correct; separate owners are not globally serialized.
- Recovery/backlog behavior is bounded and observable.
- Measurements and any failed local targets are recorded with workload and hardware context.

#### Verification

Real multi-connection tests, process termination around commit/ack, injected network failures, and before/after reconciliation; record measured metrics.

#### Learning checkpoint

Explain correctness under concurrency versus throughput, and the cost of a per-user lock.


## KT-0075

### Finish operational, security, and compatibility review

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0074](phase-7-parity-and-migration-rehearsal.md#kt-0074), [KT-0066](phase-6-realtime-and-mcp.md#kt-0066)

**User story / outcome:** As the owner of this local experiment, I can operate it without accidentally contacting production or trusting unverified emulator behavior.

#### Implementation tasks

- Audit explicit endpoints, credentials, allowed origins, disabled production deploy paths, and startup guards.
- Review auth/client scopes, identity deletion, ownership predicates, raw SQL, log redaction, and export/import boundaries.
- Complete runbooks for startup/stop/reset, migrations, queue/DLQ recovery, outbox recovery, backup/restore, and dependency upgrades.
- Publish a compatibility matrix for Cognito, RDS, gateway/ALB, scheduler/SQS, socket transport, and MCP.

#### Technical notes

Keep the review proportional to actual architecture. Do not expand into a new enterprise security program. State which AWS controls are represented only by emulator configuration and which data paths were exercised. Bind services to intended local/LAN interfaces and document access from another development device if used. Terraform plan and SDK configurations must not default to real AWS when an endpoint is missing.

#### Acceptance criteria

- A missing local endpoint fails startup instead of falling back to cloud.
- No secrets or personal financial data appear in committed fixtures/log examples.
- Every required service has an observed result or explicit gap.
- Another developer can follow recovery instructions without relying on chat history.

#### Verification

Configuration-negative tests, dependency/build checks, targeted ownership review, sanitized logging inspection, and a clean-machine/runbook rehearsal where feasible.

#### Learning checkpoint

Explain what an emulator can verify and which production assumptions remain untested.


## KT-0076

### Publish readiness report and replacement decision checkpoint

**Parent:** KT-E007 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0067](phase-7-parity-and-migration-rehearsal.md#kt-0067)–[KT-0075](phase-7-parity-and-migration-rehearsal.md#kt-0075)

**User story / outcome:** As the project owner, I can decide what to do next using concrete evidence rather than an automatic migration.

#### Implementation tasks

- Assemble feature parity, reconciliation, restore, failure, browser, MCP, and compatibility evidence.
- List unresolved defects and accepted differences by impact, with explicit follow-up tickets.
- Provide a recommendation: continue local learning, fix blockers, or prepare a separately scoped deployment/cutover plan.
- Record whether synthetic-only or authorized real-data rehearsal was performed.

#### Technical notes

Finishing this epic means the local rehearsal is complete, not that production is ready or that hosted systems should be removed. A later deployment plan must choose actual AWS hosting, networking/TLS, secrets/IAM, backups, cost controls, observability, remote OAuth/MCP exposure, and a final cutover/rollback strategy. Do not assume an old free-tier allowance still applies. No deployment action follows from this document alone.

#### Acceptance criteria

- Report contains reproducible evidence and an honest limitation list.
- No unresolved critical money/ownership defect is labeled ready.
- If no real snapshot was tested, that fact is prominent.
- Production backend, domain, user sessions, and hosted connector remain unchanged.
- Next action is a user decision, not an automated cutover.

#### Verification

Review report against the KT-0067 matrix and all epic exit criteria; verify every readiness claim points to actual test/rehearsal results.

#### Learning checkpoint

Explain the evidence needed to recommend replacing a backend and what remains unknown.

## Epic acceptance and handoff

The final report should contain:

1. Source/target/version manifest and exact rehearsal scope.
2. Feature parity matrix with passed, blocked, intentionally changed, and deferred categories.
3. Per-account and per-domain reconciliation results with zero unexplained centavo discrepancies.
4. Import rerun/interruption and backup/restore evidence.
5. Browser, HTTP, realtime, automation, and MCP isolation/failure results.
6. Measured local resource usage and known emulator limitations.
7. Outstanding defects, accepted deviations, and an actionable recommendation.

Suggested decision outcomes:

- **Continue local learning:** mechanics work, but no actual-data rehearsal or production design is complete.
- **Resolve blockers:** any unexplained financial discrepancy, ownership exposure, duplicate posting, unrecoverable import, or untested required route remains.
- **Prepare a deployment/cutover plan:** required local criteria pass, evidence is reviewed, and the user separately chooses to proceed. This is permission to plan next, not implicit permission to deploy.

All KT-0067–KT-0076 criteria and evidence must be reviewed. Stop at this checkpoint. The seven-phase migration learning plan is complete; production replacement remains a later decision.

## References and evidence limits

- [Phase 1](phase-1-local-backend-foundation.md), [Phase 2](phase-2-authentication-and-ownership.md), [Phase 3](phase-3-core-financial-operations.md), [Phase 4](phase-4-frontend-integration-and-routing.md), [Phase 5](phase-5-features-and-automation.md), and [Phase 6](phase-6-realtime-and-mcp.md).
- [Current Kwartrack specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md), inspected 2026-11-09; its existing export is not promised to be round-trippable.
- [Current MCP feature/security description](https://github.com/jcaburnay/kwartrack/blob/main/apps/mcp/README.md), inspected 2026-11-09.

No personal financial data was accessed to write this plan. Source extraction, actual implementation, and test results remain future work. Recheck current schema, versions, and deployed behavior when executing the tickets.
