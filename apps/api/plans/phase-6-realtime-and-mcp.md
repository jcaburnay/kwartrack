# KT-E006 — Phase 6: Realtime Synchronization and MCP Integration

**Project:** Kwartrack  
**Prepared:** 2026-11-09  
**Version:** 1.0  
**Status:** Planned; implementation not verified  
**Ticket range:** KT-0057–KT-0066  
**Initial estimate:** 44 story points; re-estimate after discovery  

## Objective and scope

Replace Supabase Realtime for the local backend and provide a local MCP adapter with the current five read tools and one narrowly scoped expense-write tool. All financial mutations still go through the Nest application services. Realtime notifies clients to refetch; it does not become a second ledger.

Predecessors: [Phase 4](phase-4-frontend-integration-and-routing.md) and [Phase 5](phase-5-features-and-automation.md). Realtime design can start from phase-3 commands, but coverage must include phase-5 workers, managed records, budgets, profile changes, and account deletion.

### Recommended topology and delivery contract

HTTP continues through API Gateway → VPC Link → ALB → NestJS. Socket.IO uses a separately configured local ALB route to the Nest gateway. Do not assume API Gateway HTTP API forwards the Socket.IO protocol. Prove upgrade, path handling, origin checks, authentication, and reconnect against the actual emulator path.

Start with one realtime gateway process and a PostgreSQL transactional outbox. API/worker commands append a compact owned invalidation record in the same commit as the changed data. A publisher in the gateway process claims records, emits to the authenticated owner's room, and records publication. A process crash can cause duplicate emission. A published event is not proof a browser received it; initial connection, reconnect, and foreground refresh must fetch authoritative state.

For this personal local app, Redis is not required. Multiple independent socket gateways would need shared fan-out and, depending on transport, affinity. Keep that a documented future scaling task rather than pretending an outbox with competing consumers broadcasts to every gateway.

### MCP boundary

Current repository README lists get_financial_summary, list_accounts, search_transactions, get_budget_status, list_upcoming, and create_transaction. The latter only records a user-confirmed expense; it is not general transaction CRUD. Preserve this capability boundary. Do not silently add transfers, income, edits, deletes, arbitrary SQL, or administrative access.

Use a local MCP client/Inspector or equivalent test harness. A public ChatGPT connector cannot be assumed to reach localhost. Public endpoint exposure, hosted OAuth integration, dynamic client registration, domain routing, and production connector replacement are deferred to a separately authorized deployment effort. The local suite should prove protocol behavior and authorization without claiming a hosted ChatGPT connection.

Recommended adapter: a separate local MCP process calling the Nest HTTP API with the user's verified Cognito access token and restricted capabilities. Reuse domain services behind protected endpoints; never query PostgreSQL with a broad service-role credential from MCP. Validate token intended-use/client/scope rules at the API boundary too, so an MCP token cannot call general web mutation endpoints.

### Delivery groups

1. Event inventory and outbox: KT-0057–KT-0058.
2. Gateway, browser recovery, and isolation: KT-0059–KT-0061.
3. MCP contracts, restricted tools, and handoff: KT-0062–KT-0066.

Proposed areas: API events/outbox module, authenticated Nest gateway, worker transaction hooks, web invalidation adapter, and a new local MCP runtime/adapter that preserves the existing Cloudflare/Supabase deployment.

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
| [KT-0057](#kt-0057) | Define event coverage, payloads, and realtime route contract | 3 | [KT-0056](phase-5-features-and-automation.md#kt-0056), [KT-0042](phase-4-frontend-integration-and-routing.md#kt-0042) |
| [KT-0058](#kt-0058) | Add atomic outbox recording and recoverable publication | 5 | [KT-0057](phase-6-realtime-and-mcp.md#kt-0057), [KT-0024](phase-3-core-financial-operations.md#kt-0024), [KT-0051](phase-5-features-and-automation.md#kt-0051) |
| [KT-0059](#kt-0059) | Implement authenticated Socket.IO gateway through ALB | 5 | [KT-0058](phase-6-realtime-and-mcp.md#kt-0058), [KT-0012](phase-2-authentication-and-ownership.md#kt-0012), [KT-0041](phase-4-frontend-integration-and-routing.md#kt-0041) |
| [KT-0060](#kt-0060) | Wire client invalidation, reconnect, and session cleanup | 5 | [KT-0059](phase-6-realtime-and-mcp.md#kt-0059), [KT-0040](phase-4-frontend-integration-and-routing.md#kt-0040) |
| [KT-0061](#kt-0061) | Prove realtime isolation and failure recovery | 3 | [KT-0058](phase-6-realtime-and-mcp.md#kt-0058)–[KT-0060](phase-6-realtime-and-mcp.md#kt-0060), [KT-0056](phase-5-features-and-automation.md#kt-0056) |
| [KT-0062](#kt-0062) | Define local MCP authentication and capability contracts | 5 | [KT-0056](phase-5-features-and-automation.md#kt-0056), [KT-0019](phase-2-authentication-and-ownership.md#kt-0019) |
| [KT-0063](#kt-0063) | Implement five owned read tools against the Nest API | 5 | [KT-0062](phase-6-realtime-and-mcp.md#kt-0062), [KT-0053](phase-5-features-and-automation.md#kt-0053) |
| [KT-0064](#kt-0064) | Implement the confirmed expense tool with safe replay | 5 | [KT-0062](phase-6-realtime-and-mcp.md#kt-0062), [KT-0063](phase-6-realtime-and-mcp.md#kt-0063), [KT-0028](phase-3-core-financial-operations.md#kt-0028) |
| [KT-0065](#kt-0065) | Complete MCP contract, isolation, and realtime interaction tests | 5 | [KT-0061](phase-6-realtime-and-mcp.md#kt-0061), [KT-0063](phase-6-realtime-and-mcp.md#kt-0063), [KT-0064](phase-6-realtime-and-mcp.md#kt-0064) |
| [KT-0066](#kt-0066) | Document realtime and MCP operations and hand off | 3 | [KT-0057](phase-6-realtime-and-mcp.md#kt-0057)–[KT-0065](phase-6-realtime-and-mcp.md#kt-0065) |

## KT-0057

### Define event coverage, payloads, and realtime route contract

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0056](phase-5-features-and-automation.md#kt-0056), [KT-0042](phase-4-frontend-integration-and-routing.md#kt-0042)

**User story / outcome:** As an implementer, I know which changes invalidate each screen and how clients recover from missed events.

#### Implementation tasks

- Inventory every API and worker mutation plus auth/profile deletion lifecycle.
- Define a versioned event envelope with event ID, internal owner ID, resource kind, affected IDs, and timestamp.
- Map resource changes to browser query invalidation.
- Specify local ALB socket URL/path and a single-gateway deployment boundary.

#### Technical notes

Prefer compact invalidation messages rather than complete account/transaction records. Do not emit secrets, descriptions, or another owner’s identifiers. Owner is derived from the command principal; clients never choose their subscription owner. Changes from one command may invalidate accounts, transactions, budgets, overview, and debts together. Coalesce invalidations without losing affected resource classes.

#### Acceptance criteria

- Every financial/manual/worker mutation has an event mapping.
- Payload version and unknown-version behavior are documented.
- Reconnect always refreshes authoritative state.
- Multi-gateway fan-out is explicitly unsupported until a separate design is implemented.

#### Verification

Review coverage against phase-5 command inventory and create representative serialized event fixtures.

#### Learning checkpoint

Explain invalidation events versus replication of application state.


## KT-0058

### Add atomic outbox recording and recoverable publication

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0057](phase-6-realtime-and-mcp.md#kt-0057), [KT-0024](phase-3-core-financial-operations.md#kt-0024), [KT-0051](phase-5-features-and-automation.md#kt-0051)

**User story / outcome:** As a user, a committed change remains discoverable for notification even if the API process restarts.

#### Implementation tasks

- Add owned outbox records, publication status/lease, bounded indexes, and diagnostics.
- Append events inside existing financial/metadata SQL transactions.
- Implement bounded claiming, expired-lease recovery, publication, and retry.
- Define local retention with no deletion of unpublished records.

#### Technical notes

Use the existing transaction context, not a later best-effort insert. Publication follows commit and never occurs while holding financial locks. A crash after emit but before mark-published can emit twice; client invalidation must tolerate this. An outbox row marks publish attempt/success, not guaranteed receipt by all clients. Account deletion must purge sensitive payloads or use minimal tombstones according to its lifecycle.

#### Acceptance criteria

- Rolled-back changes have no durable event.
- Committed events survive API restart and publisher outage.
- Stale claims can be retried without permanent loss.
- Duplicate emission never repeats financial effects.

#### Verification

Integration tests at transaction rollback, commit-before-publish, emit-before-mark, and lease expiry; verify no event for a rejected ownership mutation.

#### Learning checkpoint

Explain the transactional outbox and its remaining delivery limitations.


## KT-0059

### Implement authenticated Socket.IO gateway through ALB

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0058](phase-6-realtime-and-mcp.md#kt-0058), [KT-0012](phase-2-authentication-and-ownership.md#kt-0012), [KT-0041](phase-4-frontend-integration-and-routing.md#kt-0041)

**User story / outcome:** As a signed-in user, I receive change notifications only for my own data.

#### Implementation tasks

- Add a Nest Socket.IO gateway with access-token verification and internal identity resolution.
- Join a server-selected owner room after validation.
- Enforce allowed origins, payload limits, expiry handling, and connection cleanup.
- Configure/prove local ALB upgrade and Socket.IO path; document transport selection.

#### Technical notes

HTTP guards do not automatically establish socket authentication. Reuse the verifier and deleted-user checks explicitly. Prefer the Socket.IO auth payload over URL query tokens and redact handshake secrets. Disconnect at token expiry and reconnect with a fresh token; do not allow a long-lived expired session. CORS alone is not authorization for WebSocket handshakes. Avoid financial mutation handlers on this channel.

#### Acceptance criteria

- Missing, expired, wrong-client, wrong-issuer, or deleted-user sessions cannot subscribe.
- The client cannot select another user’s room.
- Expiry closes the connection according to the policy.
- Upgrade and notifications work through the ALB, not only the direct port.

#### Verification

Two-user live socket tests, forged room request, token expiry, malformed auth, origin rejection, proxy path mismatch, and actual ALB transport test.

#### Learning checkpoint

Explain why a socket connection needs its own authentication lifecycle.


## KT-0060

### Wire client invalidation, reconnect, and session cleanup

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0059](phase-6-realtime-and-mcp.md#kt-0059), [KT-0040](phase-4-frontend-integration-and-routing.md#kt-0040)

**User story / outcome:** As a user with two tabs, I see committed changes without reloading and recover after being offline.

#### Implementation tasks

- Connect/disconnect the socket with the phase-4 session provider.
- Route valid events to existing query invalidation hooks and coalesce bursts.
- Refetch on initial connection, reconnect, and focus; handle changes arriving during initial fetch.
- Dispose listeners, disconnect, clear queued work, and discard old-session callbacks on logout/user switch.

#### Technical notes

Events never apply arithmetic to displayed balances; the API returns authoritative values. Duplicate/out-of-order invalidations are harmless. Subscribe first and account for events during the initial snapshot fetch so a concurrent change cannot be missed. Use a session generation guard and avoid leaked listeners during React remounts. A disconnected banner may be informational because manual reads/writes can still work.

#### Acceptance criteria

- An Alice change updates another Alice tab; Bob’s tab gets no event.
- Offline changes appear after reconnect even if no event replay exists.
- A late Alice event cannot invalidate/populate Bob’s session incorrectly.
- Unsaved forms are preserved and stale saves use version conflict handling.

#### Verification

Browser two-tab tests, reconnect with missed messages, burst invalidation, logout during fetch, remount listener count, and concurrent initial fetch/change.

#### Learning checkpoint

Explain why reconnect resynchronization is required even when transport preserves message ordering.


## KT-0061

### Prove realtime isolation and failure recovery

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0058](phase-6-realtime-and-mcp.md#kt-0058)–[KT-0060](phase-6-realtime-and-mcp.md#kt-0060), [KT-0056](phase-5-features-and-automation.md#kt-0056)

**User story / outcome:** As a developer, I can show that realtime failure never changes financial correctness.

#### Implementation tasks

- Add tests for API, worker, split/debt, budget, profile, and deletion event coverage.
- Stop the publisher, commit changes, restart, and inspect outbox recovery.
- Drop events and verify reconnect/focus repair.
- Document queue age, publish failures, socket counts, and operational bounds.

#### Technical notes

Keep one gateway instance in the acceptance topology. If running two is desired later, it requires an explicit broadcast design; do not use competing outbox claims as fan-out. User deletion must prevent new connections and promptly close or invalidate existing ones through a tested lifecycle hook/periodic status check. No token or financial content belongs in transport logs.

#### Acceptance criteria

- Outbox failure leaves API commits correct and independently reconcilable.
- Missed/duplicate notifications converge to correct UI state.
- Deleted users lose access; foreign events never leak.
- Evidence states actual delivery guarantees rather than claiming exactly once.

#### Verification

Fault-injection tests, database reconciliation, and a live two-user browser/socket demonstration through the local route.

#### Learning checkpoint

Explain how a degraded notification channel can coexist with a correct financial system.


## KT-0062

### Define local MCP authentication and capability contracts

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0056](phase-5-features-and-automation.md#kt-0056), [KT-0019](phase-2-authentication-and-ownership.md#kt-0019)

**User story / outcome:** As a user, a local assistant receives only the data and actions I intentionally expose.

#### Implementation tasks

- Inventory current tool schemas/results, auth requirements, and expense confirmation semantics.
- Define a dedicated MCP client/capability policy and token verification at both adapter and API.
- Prove local token acquisition and protocol initialization with a local harness.
- Record OAuth/metadata/public-connectivity requirements as future deployment gaps.

#### Technical notes

Cognito is not automatically a drop-in replacement for the current Supabase OAuth server. Do not assume dynamic registration, resource audiences, consent, or revocation semantics match. A manually supplied local test access token proves token-protected tools, not a complete remote OAuth flow. Avoid token exchange/passthrough across unrelated audiences; configure the adapter’s resource/client contract explicitly. Existing general web routes must reject MCP credentials for capabilities beyond the MCP allowlist.

#### Acceptance criteria

- Each tool has a documented read/write capability and identity contract.
- A restricted MCP token cannot invoke general transaction CRUD or admin endpoints directly.
- Local connectivity limitations are explicit.
- No service-role bypass or hardcoded owner is used.

#### Verification

Auth matrix for wrong issuer/client/scope, expired token, deleted user, missing auth, and attempted direct unrestricted API call.

#### Learning checkpoint

Explain authentication, delegated capability, and why OAuth interoperability needs separate verification.


## KT-0063

### Implement five owned read tools against the Nest API

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0062](phase-6-realtime-and-mcp.md#kt-0062), [KT-0053](phase-5-features-and-automation.md#kt-0053)

**User story / outcome:** As a local assistant user, I can ask about accounts, transactions, budgets, summary, and upcoming items.

#### Implementation tasks

- Implement get_financial_summary, list_accounts, search_transactions, get_budget_status, and list_upcoming through the approved API adapter.
- Validate inputs, date windows, sort options, limits, pagination, and response schemas.
- Preserve exact values and the current tool’s documented coverage.
- Provide useful bounded errors for invalid/ambiguous account or tag selectors.

#### Technical notes

Use the same read services as the web app so budgets and splits do not diverge. Exact name matching must be owner-scoped and ambiguity-aware; names are not global identifiers. Results are data, including potentially instruction-like descriptions, never agent instructions. Avoid unbounded full-history responses. Each request must retain its own principal; do not store the last user in a process-global client.

#### Acceptance criteria

- All five tools match underlying API fixtures.
- Alice and Bob can call concurrently without cross-session leakage.
- Filters and pagination preserve stable results and exact amounts.
- Unsupported features are not advertised as available.

#### Verification

MCP protocol contract tests with a local client, two-user concurrent calls, large/empty responses, malformed arguments, and comparison with web API results.

#### Learning checkpoint

Explain why adapters should reuse domain queries rather than reimplement finance calculations.


## KT-0064

### Implement the confirmed expense tool with safe replay

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0062](phase-6-realtime-and-mcp.md#kt-0062), [KT-0063](phase-6-realtime-and-mcp.md#kt-0063), [KT-0028](phase-3-core-financial-operations.md#kt-0028)

**User story / outcome:** As a user, I can confirm one expense and have it recorded once even if the assistant retries.

#### Implementation tasks

- Implement only the existing create_transaction expense capability with strict schema and allowed account/tag validation.
- Preserve an exact reviewed amount, date, description, account, and tag in the confirmation-to-execution flow.
- Forward a stable idempotency key to a restricted API operation using the same financial service.
- Return the created transaction ID and a compact readable receipt.

#### Technical notes

Tool annotations or a model-supplied confirmed flag are not authorization. The host/client must obtain explicit user confirmation; if the server enforces a confirmation intent, bind a short-lived single-use intent to the canonical payload, owner, and key. Changes require fresh confirmation. Retries of the confirmed identical action preserve the key. Do not permit income, transfer, arbitrary account creation, edits, or deletes.

#### Acceptance criteria

- The local demo shows confirmation of exact values before execution.
- Replayed same key/body creates one expense; changed body returns conflict.
- System tags, foreign or archived accounts, and unsupported transaction types fail.
- No parser or receipt text can widen allowed actions.

#### Verification

Protocol tests for accepted/declined/changed confirmation, lost response after commit, key reuse with changed body, unauthorized account/tag, and direct API capability bypass.

#### Learning checkpoint

Explain the separation between user consent, server authorization, and idempotency.


## KT-0065

### Complete MCP contract, isolation, and realtime interaction tests

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0061](phase-6-realtime-and-mcp.md#kt-0061), [KT-0063](phase-6-realtime-and-mcp.md#kt-0063), [KT-0064](phase-6-realtime-and-mcp.md#kt-0064)

**User story / outcome:** As a developer, I can verify MCP behavior without changing the hosted connector.

#### Implementation tasks

- Exercise protocol initialize/tool discovery/read/write with the local runtime.
- Assert read/write capability annotations and error contracts against current tool scope.
- Verify a confirmed expense appears in a web tab through outbox/realtime invalidation.
- Test session expiration, revocation/deletion checks, malformed payloads, and concurrent users.

#### Technical notes

Keep the existing Cloudflare Worker deployment unmodified. Use the supported MCP SDK version found in the repository and record protocol compatibility. Local host configuration must not expose tokens in checked-in files or logs. Offline JWT verification alone does not prove immediate token revocation; document actual enforcement and test app-user disabled state separately.

#### Acceptance criteria

- All six intended tools are discoverable and only their documented capabilities succeed.
- A committed MCP expense changes the same account balance and reconciliation result as the web command.
- Expired/deleted/foreign access is denied.
- No hosted deployment or public tunnel was required.

#### Verification

Local protocol suite, browser/MCP integration, two-user concurrency, and final database reconciliation.

#### Learning checkpoint

Explain what local MCP testing proves and what remains for a future remote connector.


## KT-0066

### Document realtime and MCP operations and hand off

**Parent:** KT-E006 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0057](phase-6-realtime-and-mcp.md#kt-0057)–[KT-0065](phase-6-realtime-and-mcp.md#kt-0065)

**User story / outcome:** As the phase-7 implementer, I can operate the full local system and identify remaining migration risks.

#### Implementation tasks

- Publish startup profiles for API, worker, gateway/publisher, and MCP adapter.
- Document token setup, event envelope, outbox recovery, test commands, and feature/capability matrix.
- Record single-gateway assumptions, emulator route gaps, and remote OAuth limitations.
- Perform a fresh-stack demonstration with two users and two tabs.

#### Technical notes

Keep a clear distinction between transport notification delivery, database commit, and end-user observation. Do not treat a successful MCP Inspector call as proof that ChatGPT can reach the local endpoint. Handoff includes identities, background occurrence state, idempotency records, and outbox considerations needed for migration rehearsal.

#### Acceptance criteria

- Another agent can reproduce realtime and local MCP behavior from the docs.
- Compatibility limits and blocked requirements have explicit follow-ups.
- Feature inventory is ready for phase-7 parity review.
- Existing hosted services remain unchanged.

#### Verification

Fresh local startup, unit/integration/protocol/browser checks relevant to this epic, and a redacted evidence checklist.

#### Learning checkpoint

Explain the entire path from an assistant-confirmed expense to another tab’s refreshed balance.

## Epic acceptance and handoff

Demonstrate Alice in two tabs and Bob in a third; record a web expense and a worker-generated transaction; observe only Alice’s invalidations. Disconnect a tab, make changes, reconnect, and show correct state. Stop the publisher and recover pending outbox records. Run five MCP read tools, confirm one expense, lose/retry the response, and show one effect in the web UI. Expire a token and delete a disposable user.

Exit requires KT-0057–KT-0066 with local protocol, authorization, ALB routing, and recovery evidence. Handoff to [Phase 7](phase-7-parity-and-migration-rehearsal.md). Hosted ChatGPT connectivity and production-scale fan-out are explicitly outside this local phase.

## References and evidence limits

- [Current MCP README](https://github.com/jcaburnay/kwartrack/blob/main/apps/mcp/README.md), inspected 2026-11-09; blob 1560b1cb26cb1796975ee311bfb7365f58fa6f0d. Documents five read tools and one confirmed-expense tool, not arbitrary writes.
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), consulted 2026-11-09. Default delivery does not ensure missed server events arrive after reconnect; application recovery remains necessary.
- [Kwartrack specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md), inspected 2026-11-09.

Recheck exact Socket.IO/MCP SDK APIs and Cognito capabilities against pinned implementation versions. This plan deliberately does not assert production OAuth interoperability.
