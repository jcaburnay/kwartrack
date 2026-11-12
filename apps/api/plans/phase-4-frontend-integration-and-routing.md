# KT-E004 — Phase 4: Frontend Integration and Local Routing

**Project:** Kwartrack  
**Prepared:** 2026-11-09  
**Version:** 1.0  
**Status:** Planned; implementation not verified  
**Ticket range:** KT-0033–KT-0042  
**Initial estimate:** 42 story points; re-estimate after discovery  

## Objective and scope

Connect the existing React application to the new local backend for authentication, accounts, groups, tags, and manual financial transactions. A user can sign in, use these screens through the gateway/ALB route, and safely retry a failed request. Preserve the existing Supabase mode until a later replacement decision.

Predecessor: [Phase 3](phase-3-core-financial-operations.md), especially KT-0032, plus phase-2 identity and session evidence. A plan document alone does not make these dependencies complete.

### Included and deferred

Include a coherent local Nest backend mode, session handling, typed HTTP transport, exact money presentation, supported financial screens, browser routing/CORS verification, and end-to-end regression coverage. Phase 5 owns budgets, recurrings, debts/splits, time deposits, full dashboard, profile/export completion. Phase 6 owns cross-tab realtime and MCP. Unsupported screens in Nest mode must show a clear unavailable state or be hidden; they must never quietly query Supabase.

### Recommended decisions

| Area | Proposed default |
|---|---|
| Backend selection | Explicit startup/build configuration: supabase or nest-local; no per-request failover |
| Existing frontend | Reuse routes, forms, and visual components; isolate persistence behind adapters |
| Browser auth | Revisit PKCE now; prefer public-client authorization code + PKCE if the pinned emulator supports the complete flow |
| Local auth fallback | Retain phase-2 password harness only as an explicit local limitation; in-memory tokens, reload signs out |
| State fetching | Reuse the existing mechanism initially; add no new query library without a demonstrated need |
| Financial mutations | Wait for server confirmation; refetch affected views rather than predicting balances |
| Retry behavior | Preserve key/payload for the same pending operation; edited or new actions get a new key |
| Realtime interim | Refetch after mutations, on focus, and on reconnect; no claim of live cross-tab updates |

The auth decision must be written in KT-0034 before implementation. PKCE redirect/state verification and a BFF cookie session have different security and infrastructure requirements; do not silently mix them. A BFF is an alternative requiring an ADR and CSRF/cookie controls, not an extra requirement here.

### Delivery groups

1. Contracts and identity: KT-0033–KT-0036.
2. Financial UI and request lifecycle: KT-0037–KT-0040.
3. Browser route verification and handoff: KT-0041–KT-0042.

Proposed code areas: existing apps/web data hooks and auth providers; a backend adapter directory; shared API contract package only if justified; browser tests alongside existing tests. Inspect the repository before choosing exact paths.

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
| [KT-0033](#kt-0033) | Inventory frontend access and define backend-mode boundaries | 3 | [KT-0032](phase-3-core-financial-operations.md#kt-0032), [KT-0019](phase-2-authentication-and-ownership.md#kt-0019) |
| [KT-0034](#kt-0034) | Finalize browser authentication and callback behavior | 5 | [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033), [KT-0016](phase-2-authentication-and-ownership.md#kt-0016), [KT-0017](phase-2-authentication-and-ownership.md#kt-0017) |
| [KT-0035](#kt-0035) | Implement session refresh, logout, and user-switch isolation | 5 | [KT-0034](phase-4-frontend-integration-and-routing.md#kt-0034) |
| [KT-0036](#kt-0036) | Create the typed HTTP and exact-value adapter | 5 | [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033), [KT-0034](phase-4-frontend-integration-and-routing.md#kt-0034), [KT-0032](phase-3-core-financial-operations.md#kt-0032) |
| [KT-0037](#kt-0037) | Connect accounts, groups, and tag management | 5 | [KT-0035](phase-4-frontend-integration-and-routing.md#kt-0035), [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036) |
| [KT-0038](#kt-0038) | Connect transaction forms and safe mutation retries | 5 | [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036), [KT-0037](phase-4-frontend-integration-and-routing.md#kt-0037), [KT-0028](phase-3-core-financial-operations.md#kt-0028) |
| [KT-0039](#kt-0039) | Connect filters, pagination, totals, and URL state | 3 | [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036), [KT-0038](phase-4-frontend-integration-and-routing.md#kt-0038) |
| [KT-0040](#kt-0040) | Finish navigation, capability states, and refresh behavior | 3 | [KT-0037](phase-4-frontend-integration-and-routing.md#kt-0037), [KT-0038](phase-4-frontend-integration-and-routing.md#kt-0038), [KT-0039](phase-4-frontend-integration-and-routing.md#kt-0039) |
| [KT-0041](#kt-0041) | Verify the real browser gateway and ALB path | 5 | [KT-0040](phase-4-frontend-integration-and-routing.md#kt-0040), [KT-0007](phase-1-local-backend-foundation.md#kt-0007), [KT-0017](phase-2-authentication-and-ownership.md#kt-0017) |
| [KT-0042](#kt-0042) | Complete end-to-end evidence and phase-5 handoff | 3 | [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033)–[KT-0041](phase-4-frontend-integration-and-routing.md#kt-0041) |

## KT-0033

### Inventory frontend access and define backend-mode boundaries

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0032](phase-3-core-financial-operations.md#kt-0032), [KT-0019](phase-2-authentication-and-ownership.md#kt-0019)

**User story / outcome:** As a developer, I can select one complete local backend mode without mixing users or financial data across systems.

#### Implementation tasks

- Trace every Supabase auth/database/realtime/RPC call from supported routes, layout loaders, settings, and global widgets.
- Define adapter interfaces for auth, account/group/tag operations, transactions, and totals.
- Create a capability matrix per route and an explicit nest-local configuration with startup validation.

#### Technical notes

The current specification identifies Supabase Auth; the older Clerk implementation is archived. Use actual code as the baseline. Include hidden global fetches such as badges, upcoming widgets, and FAB options. Backend mode must partition all caches and may require a full reload to switch.

#### Acceptance criteria

- Nest-local startup rejects missing or inconsistent endpoint settings.
- Disabled features cannot call hosted Supabase in Nest mode.
- Existing Supabase mode retains its current behavior.
- Document each adapter method and phase that enables it.

#### Verification

Use a network interception test that fails on Supabase requests while exercising Nest-mode routes. Test startup errors and a Supabase-mode smoke flow.

#### Learning checkpoint

Explain why a whole-session backend boundary is safer than switching individual requests.


## KT-0034

### Finalize browser authentication and callback behavior

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033), [KT-0016](phase-2-authentication-and-ownership.md#kt-0016), [KT-0017](phase-2-authentication-and-ownership.md#kt-0017)

**User story / outcome:** As a local user, I can authenticate with Cognito and reach only my own application session.

#### Implementation tasks

- Prove authorization code + PKCE, redirect URI handling, code exchange, refresh support, and logout with the pinned Floci version.
- Record the selected flow and any unsupported operations.
- Wire sign-in, protected routes, callback validation, and a usable failure state. Keep a documented local password flow only if necessary.

#### Technical notes

Public clients have no secret. For PKCE use a fresh verifier/challenge and state; validate nonce when consuming an OIDC ID token. The API receives access tokens, never ID tokens. Do not reuse Supabase tokens or assume Cognito supports every OAuth feature needed later for MCP. If refresh rotation is selected, verify its supported operation rather than copying an incompatible flow.

#### Acceptance criteria

- Anonymous navigation redirects safely to sign-in and returns only to an allowed local path.
- Tampered state/callback and invalid/expired token fail closed.
- Auth mode and limitations are visible in developer documentation.
- Login produces a verified internal identity through /me.

#### Verification

Browser tests for success, cancelled login, wrong state, expired session, unknown issuer, and open-redirect input; actual emulator flow alongside unit tests.

#### Learning checkpoint

Explain access versus ID tokens, PKCE, and the limits of emulated managed login.


## KT-0035

### Implement session refresh, logout, and user-switch isolation

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0034](phase-4-frontend-integration-and-routing.md#kt-0034)

**User story / outcome:** As a user, signing out or switching accounts cannot expose the previous user’s cached data.

#### Implementation tasks

- Keep tokens in memory for the initial local integration.
- Implement one shared refresh operation for concurrent requests, if the chosen flow supports refresh.
- Cancel outstanding requests and clear all caches/forms on sign-out or identity change.
- Handle token expiry with a sign-in prompt and preserved non-sensitive navigation context.

#### Technical notes

Guard late responses with a session generation so Alice’s response cannot populate Bob’s view. A refresh retry must preserve a financial command’s key and body; do not blindly repeat a POST under a new key. Local clearing/revocation does not guarantee immediate invalidation of already-issued JWTs. Clear any callback verifier state after use.

#### Acceptance criteria

- Many simultaneous 401 responses cause at most one refresh attempt per session generation.
- Failed refresh ends the session without an infinite loop.
- A delayed Alice response is discarded after Bob signs in.
- Logout does not leave financial data in shared UI caches.

#### Verification

Controlled delayed responses, concurrent 401s, logout during mutation, and browser reload tests. Confirm documented reload behavior matches the chosen in-memory policy.

#### Learning checkpoint

Explain refresh coordination and why cancelling a request does not prove the server rolled back.


## KT-0036

### Create the typed HTTP and exact-value adapter

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033), [KT-0034](phase-4-frontend-integration-and-routing.md#kt-0034), [KT-0032](phase-3-core-financial-operations.md#kt-0032)

**User story / outcome:** As a frontend developer, I can call the API without losing money precision or misinterpreting dates.

#### Implementation tasks

- Implement authenticated requests, runtime response validation where appropriate, request cancellation, and structured error mapping.
- Add exact centavo-string parsing/formatting and calendar-date helpers.
- Carry correlation IDs, version fields, pagination metadata, and retry information through adapters.
- Keep DTO generation or shared types aligned with the backend OpenAPI contract.

#### Technical notes

Input such as 123.45 PHP must become "12345" centavos through decimal parsing, not multiplication of a floating-point number. Display exact totals without Number coercion. If Recharts later requires numbers, use checked bounds and retain exact strings for labels. Error types should distinguish validation, unauthorized, forbidden/not-found, conflict, rate limit, and transport uncertainty.

#### Acceptance criteria

- Round-trip money formatting preserves centavos including negative balances and large values.
- YYYY-MM-DD never shifts with browser timezone.
- Unexpected response shapes produce a usable error.
- Pagination and resource versions survive adaptation.

#### Verification

Table-driven money/date cases, API contract fixtures, error mapping tests, and a live local request.

#### Learning checkpoint

Explain the boundary between transport DTOs, domain values, and UI presentation.


## KT-0037

### Connect accounts, groups, and tag management

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0035](phase-4-frontend-integration-and-routing.md#kt-0035), [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036)

**User story / outcome:** As a local user, I can manage supported accounts and metadata with the existing UI.

#### Implementation tasks

- Connect account create/edit/archive/delete and group/tag forms to Nest adapters.
- Preserve sorting, inline group creation, credit detail strips, and historical labels.
- Hide time-deposit creation until phase 5 capability is enabled.
- Render version conflicts and referenced-resource deletion errors.

#### Technical notes

Account type and opening balance remain immutable. Archive hides accounts from new postings but does not erase history. Group net totals subtract credit debt. System tags stay visible/locked in settings and unavailable to manual pickers. Revalidate after inline creation; names alone are not stable identity.

#### Acceptance criteria

- Cash/e-wallet/savings/credit flows work through the gateway.
- Archived history remains readable; new selectors exclude archived accounts.
- A stale edit cannot overwrite a newer edit.
- No unsupported time-deposit form submits an incomplete account.

#### Verification

Browser create/edit/archive/unarchive flows, duplicate name and in-use deletion cases, owner-isolation smoke, and credit total fixtures.

#### Learning checkpoint

Explain why UI hiding complements but cannot replace server validation.


## KT-0038

### Connect transaction forms and safe mutation retries

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036), [KT-0037](phase-4-frontend-integration-and-routing.md#kt-0037), [KT-0028](phase-3-core-financial-operations.md#kt-0028)

**User story / outcome:** As a user, I can record, edit, or delete transactions without duplicating money movements after a network interruption.

#### Implementation tasks

- Connect expense, income, transfer, fee, edit/type conversion, and delete flows.
- Generate one idempotency key per logical submission and retain its exact canonical payload while outcome is uncertain.
- Reuse the original key for retry; create a new key for a changed confirmed action.
- Show pending, success, validation, conflict, and unknown-outcome states.

#### Technical notes

Disabling the submit button alone does not provide idempotency. Do not automatically resubmit an uncertain request with changed values. For the initial in-memory client, reload may lose retry metadata: instruct the user to inspect history before submitting again, rather than claiming safe durable offline recovery. Preserve expected versions on retries; replay is checked server-side before stale-version validation.

#### Acceptance criteria

- Simulated timeout after commit followed by retry produces one transaction/fee pair.
- Stale edits/deletes display a refresh/review path with no silent overwrite.
- Fee child has no independent edit/delete control.
- Successful mutation refreshes accounts, transaction list, and totals.

#### Verification

Browser test drops the committed response and retries the same request; verify database rows and balances. Cover double click, changed payload, and a 409 conflict.

#### Learning checkpoint

Explain uncertain outcomes, idempotency, and why a new human action differs from a retry.


## KT-0039

### Connect filters, pagination, totals, and URL state

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0036](phase-4-frontend-integration-and-routing.md#kt-0036), [KT-0038](phase-4-frontend-integration-and-routing.md#kt-0038)

**User story / outcome:** As a user, I can navigate accounts and transaction history predictably without stale or partial totals.

#### Implementation tasks

- Bind account/group selection and transaction filters to route search state.
- Implement bounded pagination and reset cursors when filters change.
- Render server totals independently of the current page.
- Cancel or ignore stale filter responses and preserve loading/empty/error distinctions.

#### Technical notes

Use deterministic backend ordering. A group filter represents membership semantics agreed in KT-0029, not a client-side subset of one page. Render archived references correctly. Do not infer aggregate balances by summing currently loaded transaction rows. Date-filter boundaries are calendar dates, not accidental UTC conversions.

#### Acceptance criteria

- Reload/back/forward restore supported filters.
- Rapid filter changes cannot show an older response under a new heading.
- Totals cover their documented scope, not just page one.
- Empty list and failed fetch look different.

#### Verification

Browser pagination with tied dates, rapid changes, archived accounts, deep links, and multi-page totals.

#### Learning checkpoint

Explain query identity, stable ordering, and aggregate scope.


## KT-0040

### Finish navigation, capability states, and refresh behavior

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0037](phase-4-frontend-integration-and-routing.md#kt-0037), [KT-0038](phase-4-frontend-integration-and-routing.md#kt-0038), [KT-0039](phase-4-frontend-integration-and-routing.md#kt-0039)

**User story / outcome:** As a local tester, I know which features are ready and can recover from stale data without confusion.

#### Implementation tasks

- Audit overview, sidebar, FAB, settings, and hidden route loaders for phase-5-only features.
- Render truthful temporary states for unavailable budgets/debts/automation/widgets.
- Add refetch on focus/reconnect and after relevant mutations.
- Preserve existing accessible form and narrow-screen table behavior.

#### Technical notes

This is integration, not a redesign. A chart with no backend is unavailable, not zero spending. Refetch must be deduplicated and bounded; it must not erase an unsaved form. Use the same cache invalidation interface later consumed by phase-6 events.

#### Acceptance criteria

- No dead navigation invokes a missing endpoint or falls back to hosted services.
- Account/transaction changes update dependent displays.
- Offline/error/empty/unavailable states are distinguishable.
- Keyboard focus returns sensibly after modal success/error.

#### Verification

Navigation crawl with request assertions; focus/refetch test; mobile-width and keyboard smoke checks.

#### Learning checkpoint

Explain how capability states prevent false financial information.


## KT-0041

### Verify the real browser gateway and ALB path

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 5 points  
**Depends on:** [KT-0040](phase-4-frontend-integration-and-routing.md#kt-0040), [KT-0007](phase-1-local-backend-foundation.md#kt-0007), [KT-0017](phase-2-authentication-and-ownership.md#kt-0017)

**User story / outcome:** As a developer, I can demonstrate browser requests through the intended local infrastructure.

#### Implementation tasks

- Verify browser-reachable hostnames separately from container endpoints.
- Configure exact local CORS origins and preflight behavior for Authorization, Idempotency-Key, and version headers.
- Exercise authenticated HTTP calls through API Gateway → VPC Link → ALB → NestJS.
- Check proxy prefix rewriting, redirects, request IDs, health paths, and error responses.

#### Technical notes

A direct-port success is a useful diagnostic but cannot satisfy gateway acceptance. OPTIONS must be handled without requiring a bearer token where necessary. Expose response headers consumed by the browser. Trust forwarded headers only according to the actual proxy topology; do not broadly trust arbitrary client-supplied headers. Do not weaken JWT verification to fix a hostname mismatch.

#### Acceptance criteria

- Browser preflight and all supported financial operations pass through the gateway path.
- Missing/invalid token is rejected at the documented enforcement layers.
- Backend authorization still holds via direct port.
- Unsupported emulator behavior has a recorded reproducer and blocked criterion.

#### Verification

Live browser smoke plus HTTP traces for preflight, 401, validation error, and idempotent retry; compare gateway and direct-port behavior.

#### Learning checkpoint

Explain control-plane provisioning versus data-plane routing and browser CORS.


## KT-0042

### Complete end-to-end evidence and phase-5 handoff

**Parent:** KT-E004 · **Status:** Backlog · **Priority:** High · **Estimate:** 3 points  
**Depends on:** [KT-0033](phase-4-frontend-integration-and-routing.md#kt-0033)–[KT-0041](phase-4-frontend-integration-and-routing.md#kt-0041)

**User story / outcome:** As the next implementer, I can reproduce the working local financial UI and see remaining gaps.

#### Implementation tasks

- Add a deterministic two-user browser suite for sign-in, account setup, transfer/fee, edit/delete, and retry.
- Record startup/configuration commands and the feature matrix.
- Capture exact API adapter contracts and invalidation hooks for upcoming features.
- Run existing frontend checks in both configured modes without deploying.

#### Technical notes

Use real local API/database integration for the principal flows; mocks cover UI edge cases only. Keep credentials synthetic. Do not declare full application parity while phase-5 features are disabled. Phase 6 will replace eventual focus refresh with event-triggered invalidation, not a second source of truth.

#### Acceptance criteria

- Fresh local setup reproduces the demonstration.
- Cross-user data does not leak after user switch.
- Existing supported Supabase-mode regression tests pass.
- Handoff lists auth/emulator limitations and unresolved items with owners.

#### Verification

Run focused unit/contract tests, local browser suite, typecheck/lint/build, and independent balance reconciliation after the demo.

#### Learning checkpoint

Explain the full browser-to-database request path and show the evidence for one failure case.

## Epic acceptance and handoff

Demonstrate: start the local stack; sign in as Alice; create cash and credit accounts; record an expense and a transfer with fee; lose and retry a response; edit and delete; confirm balances; sign out and sign in as Bob; verify isolation; reload with documented auth behavior. Capture routing evidence through the gateway.

Exit requires all KT-0033–KT-0042 acceptance criteria, exact financial values, no accidental hosted calls, and an explicit capability matrix. Handoff to [Phase 5](phase-5-features-and-automation.md) includes session provider, adapter interfaces, invalidation hooks, request-key lifecycle, and any unresolved PKCE limitations. No production replacement occurs.

## References and evidence limits

Planning inputs: [Phase 2](phase-2-authentication-and-ownership.md), [Phase 3](phase-3-core-financial-operations.md), and [current Kwartrack specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md), inspected 2026-11-09 (spec blob d46cf360fec0d3fa840c8561dae01a0c244baf70). Recommendations are not claims that these changes already exist. Recheck current auth SDK and Floci behavior during KT-0034.
