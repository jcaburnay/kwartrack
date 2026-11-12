# KT-E002 — Phase 2: Authentication and Data Ownership

**Project:** Kwartrack  
**Document version:** 1.0  
**Prepared:** 2026-11-06  
**Epic status:** In progress — KT-0010 and KT-0011 verified locally on 2026-11-12; remaining tickets planned  
**Predecessor:** KT-E001 — Local Backend Foundation  
**Ticket range:** KT-0010–KT-0019  
**Delivery format:** Standalone implementation plan. IDs are planning identifiers, not existing GitHub issues.

## 1. Goal and demonstrable outcome

Build a local Cognito authentication flow and establish the ownership boundary that all later financial endpoints will use.

At completion, two synthetic users can sign in through the emulated Cognito service, obtain access tokens, call a protected NestJS endpoint, and manipulate only their own disposable ownership-test records. The same protection applies when requests enter through API Gateway, through ALB, or directly through the local API port.

This phase builds the authorization foundation; it does not migrate existing users, passwords, account balances, or financial data. Actual account and transaction isolation tests will be added alongside those features in phase 3.

### Included

- Cognito user pool and public app client managed by Terraform.
- A version-specific compatibility experiment for authentication, tokens, refresh, and local JWKS discovery.
- Two synthetic local users and repeatable fixture preparation.
- Strict JWT verification in NestJS, a protected-by-default HTTP guard, and typed request identity.
- PostgreSQL application-user mapping using a stable internal UUID.
- Explicit owner-scoped database access and a disposable ownership test module.
- A separate local auth test page for sign-in, refresh, sign-out, and calling protected endpoints.
- API Gateway JWT authorizer integration while retaining backend verification.
- Negative tests, lifecycle behavior, validation-only CI, documentation, and a handoff contract for phase 3.

### Excluded

- Replacing the existing React application's Supabase Auth integration. Full frontend integration remains phase 4.
- Better Auth, Clerk, custom password storage, or a new authentication service.
- Production Cognito resources, real email/SMS delivery, or hosted OAuth providers.
- Production user migration, password-hash copying, identity linking by email, and data imports.
- MFA, passkeys, social login, multi-organization tenancy, roles/permissions administration, and M2M authentication.
- WebSocket authentication and MCP OAuth integration; these need separate designs in phase 6.
- A full production account-recovery experience. Local recovery compatibility is investigated and recorded; missing support cannot be represented as tested production behavior.

## 2. Relationship to phase 1

Read the current [phase-1-local-backend-foundation.md](phase-1-local-backend-foundation.md) alongside this document. Keep the two files together for relative links.

Phase 1 is a plan, not evidence that its implementation already exists. Before starting this epic, inspect the repository and record which predecessor tickets have actually passed.

| Required foundation | Phase-1 ticket | Phase-2 use |
|---|---|---|
| NestJS/Express workspace and test tooling | KT-0001 | Auth module, guard, and API tests |
| Explicit local configuration and safeguards | KT-0002 | Cognito/JWKS endpoints and dummy credentials |
| Floci/Docker environment | KT-0003 | Local user pool and authentication |
| Terraform-managed PostgreSQL | KT-0004 | Application users and ownership fixtures |
| Drizzle provider and migrations | KT-0005 | User identity mapping and owner-scoped access |
| Health checks and API docs | KT-0006 | Explicit public endpoints and bearer documentation |
| Gateway/VPC Link/ALB path | KT-0007 | Gateway authorizer integration |
| Validation-only CI and setup | KT-0008–KT-0009 | Repeatable authentication tests and onboarding |

KT-0010 may begin as a bounded compatibility investigation once the emulator exists. Completing the epic requires the applicable phase-1 foundations. Do not silently redesign the routing architecture to work around an unresolved predecessor blocker.

### Repository constraints carried forward

- Keep the existing web/MCP deployment behavior and Supabase migrations intact.
- New SQL migrations remain under `apps/api/drizzle`; never put them in `supabase/migrations`.
- Use the established Node/pnpm versions and Biome. Recheck current repository instructions before implementation.
- Keep work on an isolated branch/worktree. A merge to `main` can trigger existing deployments even when the new API itself is local-only.
- Do not overwrite existing web environment files or clear Supabase sessions from the new auth test page.
- No production records, copied password hashes, or hosted credentials in fixtures or commits.

## 3. Recommended technical decisions

These are proposed implementation defaults, not a claim that all Floci features have been verified.

| Decision | Recommendation | Reason |
|---|---|---|
| Identity provider | Cognito user pool through Floci | Confirmed project choice |
| App client | Public client without client secret | Browser clients cannot keep a secret |
| Initial local sign-in | Cognito `USER_PASSWORD_AUTH`, explicitly enabled for the local client | Small, inspectable first integration with the AWS SDK |
| Browser transport | `@aws-sdk/client-cognito-identity-provider`, with explicit emulator endpoint | Exercises Cognito operations without changing the production UI |
| Browser token storage | In memory only; reload requires sign-in | Keeps the learning harness small and avoids persistent bearer-token storage |
| Token accepted by API | Cognito user access token only | ID tokens must not authorize financial APIs |
| Verifier implementation | `jose` with remote JWKS and explicit Cognito claim checks | Supports a locally configured issuer/JWKS URL without assuming AWS hostnames |
| Backend enforcement | Global NestJS guard plus explicit `@Public()` metadata | New routes should require authentication by default |
| Internal identity | Generated UUID with unique `(issuer, subject)` mapping | Decouples application ownership from Cognito pool lifecycle |
| Ownership | Explicit owner predicates in Drizzle queries | Auditable authorization boundary for the new backend |
| Gateway enforcement | JWT authorizer in addition to the Nest guard | Practices edge validation without trusting a bypassable local network path |
| Sign-out semantics | Clear local state and revoke refresh credential when supported; access tokens may remain valid until expiry | Avoids promising immediate revocation from offline JWT validation |

### Decisions intentionally deferred

- Before the real frontend migration, review authorization code with PKCE/managed login versus a backend-for-frontend session design. The local password-flow harness is not a final production-browser recommendation.
- If refresh-token rotation is enabled later, revisit the chosen refresh operation and replay policy. Do not mix rotation with an incompatible refresh flow.
- PostgreSQL RLS may be added as defense in depth later. Phase 2 does not recreate Supabase's auth context or rely on its `auth.uid()` policies.
- Immediate global logout of all already-issued API access tokens would require additional online/session-revocation enforcement. It is outside this epic.

### Request flow

1. The local auth test page sends sign-in requests to Floci Cognito.
2. Cognito returns tokens; the client keeps them only in memory.
3. The client sends `Authorization: Bearer <access-token>` to the API Gateway URL.
4. Gateway validates its configured JWT requirements and forwards the request through the existing ALB path.
5. NestJS independently verifies the original bearer token and resolves a local application-user identity.
6. A service receives the trusted internal user ID and scopes its database queries accordingly.

Cognito authentication does not run inside API Gateway or ALB. Those services do not replace the NestJS ownership checks.

## 4. Authentication and ownership contracts

### Configuration

Extend the phase-1 configuration with independently named values for:

- Cognito management/sign-in endpoint, user-pool ID, app-client ID, and region.
- Expected token issuer: exact value to validate, not derived from an incoming token.
- Trusted local JWKS fetch URL: may differ in hostname from the issuer to accommodate Docker networking.
- JWT clock tolerance, JWKS timeout/cache policy, and access-token lifetime.
- Auth-test-page origin and gateway base URL.

A hostname rewrite for fetching keys must not weaken issuer comparison. Never use an unverified token's `iss`, `jku`, or `x5u` to select an arbitrary network destination. Local configuration must explicitly permit only the intended emulator addresses. Pin the signer algorithm observed and expected for the chosen Cognito implementation, initially RS256.

### Verified principal

Use a request-scoped immutable value, conceptually:

```ts
type AuthPrincipal = Readonly<{
  userId: string;       // Internal application UUID
  issuer: string;      // Verified identity-provider issuer
  subject: string;     // Verified Cognito user sub
  clientId: string;    // Verified allowed public app client
  scopes: readonly string[];
}>;
```

Do not store the principal in a mutable singleton or accept its fields from body/query/custom headers. A TypeScript type alone does not establish that a value was authenticated.

### Database model

| Field | Purpose |
|---|---|
| `app_user.id` | Internal UUID used by future ownership foreign keys |
| `app_user.auth_issuer` | Canonical verified identity-provider issuer |
| `app_user.auth_subject` | Verified user subject |
| `app_user.created_at` | Application identity creation time |
| `app_user.updated_at` | Optional timestamp if mutable metadata is introduced |

Add a unique constraint on `(auth_issuer, auth_subject)`. Email is not the identity key and is not required for provisioning from an access token. If display email is needed later, obtain it through a verified provider response/profile flow; do not trust a submitted email or assume the access token contains one.

For authorization verification, add a small local/test-only `ownership_probe` table with an `owner_user_id` foreign key, UUID ID, bounded text field, and timestamps. This is a disposable testing facility, not Kwartrack's future accounts model. Its HTTP module must be disabled outside explicit local/test modes.

### Endpoint contract

| Route | Authentication | Behavior |
|---|---|---|
| `GET /health/live` | Public | Retain phase-1 process liveness |
| `GET /health/ready` | Public within local infrastructure | Retain bounded readiness; no credential details |
| `GET /v1/me` | Access token required | Return minimal internal user identity and provider subject |
| `POST /v1/dev/ownership-probes` | Access token required; local/test module only | Create record owned by verified user |
| `GET /v1/dev/ownership-probes` | Access token required; local/test module only | List only verified user's records |
| `GET/PATCH/DELETE /v1/dev/ownership-probes/:id` | Access token required; local/test module only | Act only on a matching owner/record pair |

Malformed/absent/invalid credentials produce 401. A valid principal lacking a required permission produces 403 where applicable. Access to another user's record and a nonexistent record both produce 404; do not disclose which case occurred. Invalid DTO fields produce 400. Identity database or key-service outages produce a documented 503 when verification cannot proceed; distinguish outages from known-invalid tokens without leaking sensitive details.

### Authorization rules

- Create: set owner from the principal; reject client-supplied owner fields.
- Read/list: constrain by the principal's internal user ID in SQL.
- Update/delete: combine record ID and owner ID in the mutation predicate, then check affected rows.
- Future relationships: validate both related records belong to the same owner, within the business transaction where needed.
- Nested routes, aggregates, exports, queues, and MCP calls do not receive implicit exemptions.
- Background workers need their own explicit actor/ownership design in a later phase; do not invent a default system user now.

## 5. Agile organization and dependency map

Parent epic: KT-E002. Continue the existing IDs; reserve KT-0020 onward for later work.

| ID | Ticket | Type | Priority | Points | Depends on |
|---|---|---|---|---:|---|
| [KT-0010](#kt-0010) | Auth contract and compatibility experiment | Spike | High | 3 | KT-0002, KT-0003 |
| [KT-0011](#kt-0011) | Cognito infrastructure and synthetic users | Task | High | 5 | KT-0010; phase-1 Terraform |
| [KT-0012](#kt-0012) | Strict access-token verifier | Task | High | 5 | KT-0011 |
| [KT-0013](#kt-0013) | Application-user identity mapping | Task | High | 3 | KT-0010, KT-0005 |
| [KT-0014](#kt-0014) | Global auth guard and current-user API | Feature | High | 5 | KT-0012, KT-0013 |
| [KT-0015](#kt-0015) | Owner-scoped access and test resource | Feature | High | 5 | KT-0014 |
| [KT-0016](#kt-0016) | Local browser sign-in and session lifecycle | Feature | High | 5 | KT-0011, KT-0014 |
| [KT-0017](#kt-0017) | Gateway JWT authorizer integration | Task | High | 5 | KT-0014, KT-0007 |
| [KT-0018](#kt-0018) | Isolation, token, and lifecycle test suite | Task | High | 5 | KT-0015, KT-0016, KT-0017 |
| [KT-0019](#kt-0019) | Rehearsal, documentation, and handoff | Task | High | 3 | KT-0018 |

**Initial estimate: 44 points.** Points indicate relative complexity, not hours. Re-estimate after KT-0010. Split a ticket if its compatibility work grows; preserve existing identifiers and link the new ticket.

Suggested delivery groups:

1. Identity provider and contracts: KT-0010–KT-0013.
2. Backend protection and isolation: KT-0014–KT-0015.
3. Browser/gateway integration: KT-0016–KT-0017.
4. Verification and handoff: KT-0018–KT-0019.

Use Backlog → Ready → In progress → Review → Done, with Blocked when a compatibility issue prevents acceptance. Prefer one focused PR per ticket. Review actual evidence before marking completion. Every ticket includes implementation details, technical notes, acceptance criteria, and a learning checkpoint.

## KT-0010

### Define the auth contract and prove Cognito compatibility

**Parent:** KT-E002  
**Status:** Done — locally verified 2026-11-12; see [auth contract evidence](../../../docs/adr/phase-2-auth-contract.md)  
**Type / estimate:** Spike / 3 points  
**Depends on:** KT-0002, KT-0003  
**Unblocks:** [KT-0011](#kt-0011), [KT-0013](#kt-0013)  
**Suggested branch:** `docs/KT-0010-auth-contract`

**User story:** As a developer, I want to verify the local identity-provider behavior before building an authentication layer around unsupported assumptions.

#### Deliverables and implementation tasks

1. Record the actual phase-1 version matrix and known blockers.
2. Create a disposable pool/client using the local endpoint. Prove sign-in with a synthetic confirmed user and capture token claim names only, never full live token values in documentation.
3. Fetch discovery/JWKS and compare issuer/key behavior from host and container environments.
4. Probe refresh, revoke, wrong password, disabled user, signup/confirmation, and password-recovery support. Separate supported, unsupported, and not-tested behavior.
5. Confirm browser-origin access/CORS to Cognito. Record exact SDK operations and allowed auth-flow configuration.
6. Decide the local issuer/JWKS mapping and the library configuration needed to preserve strict verification.
7. Write an ADR for the local password flow, public client, in-memory browser tokens, ownership strategy, and logout limitations.
8. Timebox the first experiment to a focused 2–4 hour implementation session. Record a reproducible blocker instead of extending it indefinitely or weakening validation.

#### Technical notes

- A local SDK authentication flow is distinct from OAuth authorization-code login. Do not enable arbitrary OAuth grants just because an emulator accepts them.
- Use a real user-authentication result; a machine client-credentials token must not provision an application user.
- Floci behavior is version-specific. Treat its advertised features as leads to test, not acceptance evidence.
- If host/container issuer URLs differ, investigate canonical configuration and trusted key-fetch overrides. Never solve it by dropping issuer or signature checks.
- Refresh/revocation gaps must result in an explicit blocker or documented scope decision for dependent tickets.

#### Acceptance criteria

- [ ] ADR specifies token type, app client, identity mapping, local flow, and error semantics.
- [ ] Signed access token is obtained and verified using local public keys.
- [ ] Host/container addressing and browser CORS findings are recorded.
- [ ] Compatibility matrix includes successful and negative operations.
- [ ] No production endpoint, user, or credential was used.

**Verification:** Preserve redacted commands/results and version information; destroy only disposable experiment resources.  
**Learning checkpoint:** Explain authentication versus authorization, user pool versus app client, access token versus ID token, and issuer versus JWKS URL.

## KT-0011

### Provision Cognito and reproducible synthetic users

**Parent:** KT-E002  
**Status:** Done — locally verified 2026-11-12; see [fixture and persistence evidence](../../../docs/local-auth.md)  
**Type / estimate:** Task / 5 points  
**Depends on:** [KT-0010](#kt-0010), phase-1 Terraform setup  
**Unblocks:** [KT-0012](#kt-0012), [KT-0016](#kt-0016)  
**Suggested branch:** `feat/KT-0011-local-cognito`

**User story:** As a developer, I want a repeatable local user pool and two test users so authentication tests do not depend on manual setup.

#### Deliverables and implementation tasks

1. Extend the existing local Terraform root with a user pool and secretless app client.
2. Explicitly enable the proven sign-in and refresh flows; configure a supported short access-token lifetime, initially target 15 minutes, and record the actual value.
3. Export pool/client IDs and canonical issuer information into ignored local runtime configuration.
4. Create `alice@kwartrack.local` and `bob@kwartrack.local` through a project-scoped fixture script using admin operations only from the trusted setup environment.
5. Set documented local-only synthetic credentials and confirmed states as needed; suppress external delivery. Keep password setup outside Terraform where practical to avoid retaining it in state.
6. Make fixture preparation idempotent without recreating users or changing their `sub` on every run.
7. Add an explicit destructive auth-reset command separate from normal setup, and document its impact on identity mappings.

#### Technical notes

- No browser app-client secret and no IAM credentials in frontend configuration. User-pool client IDs are public configuration.
- Admin creation/confirmation is fixture setup, not a public signup endpoint or proof that email verification works.
- Cognito and PostgreSQL have separate lifecycles; recreating a pool may produce new subjects. Never relink old application data by matching email.
- Keep the phase-1 provider endpoint safeguards and ensure Cognito-specific calls use the local override too.

#### Acceptance criteria

- [ ] Terraform recreates the pool/client and a second plan has no unexpected changes.
- [ ] Both synthetic users can authenticate and have distinct subjects.
- [ ] Repeated fixture setup preserves subjects and does not duplicate users.
- [ ] Browser client has no secret or administrator capability.
- [ ] Routine setup does not erase users, mappings, or existing phase-1 fixtures.
- [ ] Reset consequences and local credentials are clearly documented.

**Verification:** Apply, seed twice, sign in both users, restart Floci, and verify the documented persistence behavior.  
**Learning checkpoint:** Explain resource provisioning versus user seeding, public app clients, and why email is not a durable ownership key.

## KT-0012

### Implement strict Cognito access-token verification

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Task / 5 points  
**Depends on:** [KT-0011](#kt-0011)  
**Unblocks:** [KT-0014](#kt-0014)  
**Suggested branch:** `feat/KT-0012-token-verifier`

**User story:** As an API consumer, I want valid user access tokens recognized and invalid or inappropriate tokens rejected consistently.

#### Deliverables and implementation tasks

1. Implement an injectable verifier using a pinned compatible `jose` version and a configured remote JWKS source.
2. Verify signature, allowed algorithm, exact issuer, expiration, relevant time claims, expected client ID, `token_use=access`, and nonempty user subject.
3. Apply the bounded clock tolerance selected in the ADR. Do not accept unlimited skew or tokens missing required expiry/identity claims.
4. Restrict accepted tokens to the configured user-auth client; do not add M2M clients to its allowlist.
5. Parse scope claims into a normalized array. Require scopes only where deliberately configured.
6. Cache keys with bounded network timeouts and refresh handling for an unknown key ID. Handle invalid signatures separately from transient key-fetch failure.
7. Return verified claims in a typed object; do not expose unverified decoded claims as a principal.
8. Add deterministic unit fixtures signed by a test-only key pair and at least one real-emulator verification test.

#### Technical notes

- Access tokens normally identify the app client with `client_id`; ID-token audience checking is not a substitute.
- Reject ID tokens even when correctly signed for the same pool/client.
- Do not assume user attributes such as email appear in an access token.
- A trusted issuer and a trusted key-fetch URL can be configured separately for local Docker routing; both remain explicit configuration.
- Cached trusted keys may allow verification during a brief provider outage; unknown keys must never be accepted without verification.

#### Acceptance criteria

- [ ] Real local access tokens verify with strict issuer/client/token-type checks.
- [ ] Missing expiry/subject, expired, tampered, wrong-key, wrong-issuer, wrong-client, wrong-token-use, and disallowed-algorithm cases fail.
- [ ] ID tokens and tokens from a separate test machine client cannot become user principals.
- [ ] Unknown key behavior and bounded JWKS failures are tested.
- [ ] Token material and secrets are absent from logs/errors.

**Verification:** Test with controlled clocks and signed fixtures; use the emulator for the happy path and actual discovery. Do not wait 15 minutes to test expiry.  
**Learning checkpoint:** Explain decoding versus verification, asymmetric signing, key rotation, claim validation, and offline verification limitations.

## KT-0013

### Add stable application-user identity mapping

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Task / 3 points  
**Depends on:** [KT-0010](#kt-0010), KT-0005  
**Unblocks:** [KT-0014](#kt-0014)  
**Suggested branch:** `feat/KT-0013-application-users`

**User story:** As a developer, I want stable application IDs independent of provider details so every future financial record has a consistent owner.

#### Deliverables and implementation tasks

1. Add the `app_user` Drizzle schema and reviewed migration described in section 4.
2. Enforce the unique `(auth_issuer, auth_subject)` pair in PostgreSQL.
3. Implement a narrow identity-resolution service that accepts verified identity data from the auth layer.
4. Use a concurrency-safe insert-on-conflict/select flow for first-request provisioning.
5. Return the same internal user ID on subsequent requests. Do not update mutable profile fields on every API call.
6. Document pool-reset behavior and prohibit email-based automatic linkage.
7. Preserve the existing foundation fixtures and migration history.

#### Technical notes

- A user can be provisioned after successful verification on their first protected API request; no Cognito trigger is required for this phase.
- Unique constraints, not a preliminary existence check alone, prevent duplicate first-request mappings.
- Make the service usable with a transaction where necessary, but avoid a generic repository framework before features need it.
- If database resolution fails, reject the request with a service error; never fall back to a placeholder/shared user ID.

#### Acceptance criteria

- [ ] New verified identity creates one internal user.
- [ ] Repeated and concurrent first requests resolve to one row and one ID.
- [ ] Two different subjects map to different internal users.
- [ ] The same subject under a different trusted issuer maps separately.
- [ ] Unverified payloads cannot call the provisioning path through a public API.
- [ ] Migrations remain outside Supabase and apply cleanly to the phase-1 database.

**Verification:** Run integration tests for concurrency, uniqueness, and database failure; reapply migration commands to confirm repeatability.  
**Learning checkpoint:** Explain surrogate IDs, composite unique constraints, race conditions, and why provider identity differs from display attributes.

## KT-0014

### Protect HTTP routes and expose the current-user endpoint

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Feature / 5 points  
**Depends on:** [KT-0012](#kt-0012), [KT-0013](#kt-0013)  
**Unblocks:** [KT-0015](#kt-0015), [KT-0016](#kt-0016), [KT-0017](#kt-0017)  
**Suggested branch:** `feat/KT-0014-auth-guard`

**User story:** As a signed-in user, I want protected routes to identify me reliably, while unauthenticated requests cannot access application data.

#### Deliverables and implementation tasks

1. Register a global HTTP guard through Nest dependency injection.
2. Parse bearer headers strictly and reject ambiguous/malformed credentials.
3. Verify the token, resolve the application user, and attach an immutable principal to the request.
4. Add a typed current-user parameter decorator and an explicit `@Public()` decorator.
5. Mark only the intended health endpoints public. Keep local documentation exposure explicit rather than making a broad URL prefix public.
6. Implement `GET /v1/me` returning minimal internal/provider identity, never tokens.
7. Add an API DTO validation pipe appropriate to the project; reject unexpected sensitive fields.
8. Update OpenAPI bearer security definitions and documented errors.

#### Technical notes

- Authentication and ownership checks remain separate responsibilities. A valid token does not grant access to every record.
- A request header such as `x-user-id`, gateway claims header, or body `userId` must not override the verified principal.
- ALB health requests have no user token; explicitly public health routes must remain operational.
- CORS preflight must work through the configured middleware/gateway path without making actual protected requests anonymous.
- Keep principal state per request; two simultaneous users must not overwrite each other's identity.

#### Acceptance criteria

- [ ] New routes are protected unless explicitly declared public.
- [ ] `/v1/me` identifies the caller and rejects invalid/missing credentials.
- [ ] Health endpoints continue to work without authentication.
- [ ] Forged identity headers do not affect the principal.
- [ ] Concurrent requests from Alice and Bob remain isolated.
- [ ] Direct API calls enforce the same token validation as gateway calls.

**Verification:** Exercise guard/controller integration and compiled builds; verify dependency injection and decorator behavior remain compatible with phase-1 test tooling.  
**Learning checkpoint:** Explain guards, request context, custom decorators, DTO validation, and authentication middleware ordering.

## KT-0015

### Establish owner-scoped database access with a disposable test resource

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Feature / 5 points  
**Depends on:** [KT-0014](#kt-0014)  
**Unblocks:** [KT-0018](#kt-0018), phase-3 financial endpoints  
**Suggested branch:** `feat/KT-0015-owner-isolation`

**User story:** As a user, I want my records accessible only to me, even if another authenticated user knows their IDs.

#### Deliverables and implementation tasks

1. Add the disposable `ownership_probe` schema and local/test-only module.
2. Implement create/list/read/update/delete operations using the section-4 contract.
3. Pass the trusted internal user ID explicitly from controller/service boundaries.
4. Scope SQL reads and writes by owner; combine owner and record predicates in updates/deletes.
5. Reject submitted ownership fields rather than trusting or silently propagating them.
6. Add a developer note showing how the same pattern applies to accounts, transaction lists, transfers, and joins in phase 3.
7. Restrict probe endpoints and schemas to the documented local experiment; keep them out of any future production profile.

#### Technical notes

- Use foreign keys and indexes for `owner_user_id` and the query patterns actually implemented.
- Do not fetch every user's records and filter them in JavaScript.
- Avoid check-then-update races by enforcing owner predicates in the SQL mutation itself.
- A 404 response for another owner's record must not reveal the true owner or existence in its body.
- The probe demonstrates a reusable boundary; it is not evidence that unimplemented financial endpoints are already secure.

#### Acceptance criteria

- [ ] Alice and Bob can create and manage their own records.
- [ ] Each user's list excludes the other's records.
- [ ] Cross-user read/update/delete return 404 and leave the target unchanged.
- [ ] Body/query/header owner spoofing cannot transfer ownership.
- [ ] The module is absent when local/test mode is disabled.
- [ ] Database constraints reject an invalid owner reference.

**Verification:** Run the full two-user CRUD matrix and verify database state after denied mutations.  
**Learning checkpoint:** Explain object-level authorization, owner-scoped queries, foreign keys, and why hidden UI controls do not enforce authorization.

## KT-0016

### Build a local auth test page and define session lifecycle

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Feature / 5 points  
**Depends on:** [KT-0011](#kt-0011), [KT-0014](#kt-0014)  
**Unblocks:** [KT-0018](#kt-0018)  
**Suggested branch:** `feat/KT-0016-auth-lab`

**User story:** As a developer, I want to sign in and inspect protected API behavior in a browser before integrating the real finance screens.

#### Deliverables and implementation tasks

1. Add a separate development-only `apps/auth-lab` Vite page, or an equivalently isolated harness agreed in the ADR. Do not change the production web app's auth provider.
2. Provide minimal sign-in, current-user, refresh, and sign-out controls. Show user identity and status without rendering full tokens.
3. Use the public SDK sign-in flow proven in KT-0010. Keep admin fixture operations outside the browser.
4. Store access/refresh tokens in memory; reload returns to signed-out state. Never store them in query strings, logs, localStorage, or committed fixtures.
5. Implement one coordinated refresh at a time, bounded retries, and clearing state when refresh credentials expire or are rejected.
6. Implement sign-out by clearing in-memory state and revoking the refresh credential using the proven provider operation. Clearing state must still happen if the network call fails; show the limitation clearly.
7. Prevent an in-flight refresh/API response from restoring Alice's state after sign-out or after Bob signs in, using a session generation/cancellation strategy.
8. Prefer the gateway base URL once KT-0017 is ready; allow explicit direct API mode for isolated debugging.
9. Add optional local signup/confirmation/recovery controls only when the experiment proves a safe local code-delivery mechanism. Otherwise record them as deferred, not completed.

#### Technical notes

- No client secret or dummy AWS administrator keys belong in the page bundle.
- Protecting tokens from persistent storage does not remove XSS risk; the harness is a limited development tool, not a complete production security design.
- Cognito refresh revocation does not by itself make every offline JWT verifier reject an unexpired access token. Document that residual validity window.
- For this local client, use the proven non-rotating refresh flow. If rotation is selected, update both configuration and SDK operation through the ADR.
- Do not automatically retry future non-idempotent financial writes after refresh; phase 4 must define safe request retry behavior.

#### Acceptance criteria

- [ ] Both test users can sign in and call `/v1/me`.
- [ ] Wrong credentials produce a useful generic error without exposing account details.
- [ ] Refresh works and concurrent requests do not create a refresh storm.
- [ ] Sign-out clears state; a subsequent API call has no bearer token.
- [ ] Revoked refresh credentials cannot obtain a new session in the supported test path.
- [ ] Reload requires sign-in and no tokens remain in persistent browser storage.
- [ ] Late responses cannot resurrect a logged-out or replaced session.
- [ ] The existing React app's login/session behavior is unchanged.

**Verification:** Manual browser walkthrough plus deterministic client-state tests for refresh, sign-out races, and refresh failure. Record any provider lifecycle gap as blocked rather than bypassing verification.  
**Learning checkpoint:** Explain access/refresh lifetimes, local sign-out versus revocation, browser token storage, and PKCE as a later frontend decision.

## KT-0017

### Add API Gateway JWT authorization while retaining backend checks

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Task / 5 points  
**Depends on:** [KT-0014](#kt-0014), KT-0007  
**Unblocks:** [KT-0018](#kt-0018)  
**Suggested branch:** `feat/KT-0017-gateway-auth`

**User story:** As a developer learning AWS, I want invalid requests rejected at the API entry point while backend security remains intact on every reachable path.

#### Deliverables and implementation tasks

1. Extend Terraform with an HTTP API JWT authorizer, explicit issuer, and expected audience/client configuration.
2. Attach it to protected `/v1` routes; preserve explicit unauthenticated health routes and working preflight behavior.
3. Verify that the original Authorization header reaches NestJS through ALB.
4. Resolve local discovery/JWKS connectivity from inside Floci without modifying token issuer semantics or broadly allowing arbitrary issuer hosts.
5. Confirm how the gateway treats `aud` versus `client_id` using actual tokens. Configure the expected values accordingly.
6. Keep NestJS's strict `token_use=access` verification. Do not rely on the generic gateway authorizer to distinguish ID and access tokens.
7. Only configure custom route scopes once the chosen Cognito flow actually issues them; do not confuse `aws.cognito.signin.user.admin` with application administrator privilege.
8. Record auth behavior through direct API, ALB, and gateway routes, including invalid credentials and infrastructure failures.

#### Technical notes

- The local direct API/ALB paths remain reachable for development and therefore must independently enforce authentication.
- A gateway accepting an ID token must still result in rejection by NestJS. Document this division of responsibility instead of marking backend validation redundant.
- Gateway JWT validation concerns token trust, not record ownership.
- If Floci's JWT authorizer is unsupported/broken in the pinned version, preserve strict Nest verification and record gateway enforcement as blocked or explicitly deferred through a scope decision.

#### Acceptance criteria

- [ ] A valid access token works through the complete gateway/ALB path.
- [ ] Missing, expired, wrong-issuer, and wrong-client credentials are rejected on the protected path.
- [ ] ID tokens cannot successfully access a protected endpoint on any path.
- [ ] Authenticated user identity is unchanged across routing hops.
- [ ] Health checks and configured preflights still work.
- [ ] Authorizer resources are reproducible and a second Terraform plan has no unexpected drift.
- [ ] Evidence distinguishes gateway rejection from backend rejection.

**Verification:** Run a path-by-token matrix, inspect redacted correlation logs, and test a direct ALB bypass attempt.  
**Learning checkpoint:** Explain edge authentication, backend authentication, scope checks, and resource ownership as distinct controls.

## KT-0018

### Consolidate token, lifecycle, and ownership integration coverage

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Task / 5 points  
**Depends on:** [KT-0015](#kt-0015), [KT-0016](#kt-0016), [KT-0017](#kt-0017)  
**Unblocks:** [KT-0019](#kt-0019)  
**Suggested branch:** `test/KT-0018-auth-isolation`

**User story:** As a maintainer, I want automated evidence that authentication failures and cross-user access attempts cannot expose or modify another user's records.

#### Deliverables and implementation tasks

1. Consolidate tests introduced with prior tickets; avoid reimplementing identical checks.
2. Separate cryptographic/clock unit tests, HTTP guard tests, database ownership tests, browser-state tests, and real Floci/gateway smoke tests.
3. Use isolated pool/client/database fixtures with deterministic cleanup. Never reset a developer's normal local users or database as incidental test cleanup.
4. Include concurrent identity provisioning, simultaneous Alice/Bob requests, denied mutation state checks, and delayed refresh/sign-out races.
5. Test invalid signatures and claims with controlled test keys; supplement with real emulator tokens. Do not weaken verification to make negative tests convenient.
6. Test local JWKS availability, unknown key IDs, and database identity-resolution failure.
7. Extend validation-only CI with the required auth suites and compiled API checks. No hosted AWS credentials or deployment jobs.
8. Record unsupported emulator scenarios separately from actual passes. A requested integration suite missing dependencies must fail clearly.

#### Minimum test matrix

| Scenario | Expected result |
|---|---|
| Public health request without token | 200 according to health state |
| Protected request without/malformed bearer token | 401 |
| Valid Alice/Bob access token | Correct distinct internal user |
| Expired/tampered/wrong issuer/client token | Rejected |
| Correctly signed ID token | Rejected as API credential |
| Unsupported algorithm or missing required claim | Rejected |
| Spoofed owner body/header | Rejected or ignored as identity input; never changes owner |
| Alice accesses Bob's probe by ID | 404; no data or mutation |
| Concurrent first login | One mapping per verified identity |
| Uncached key fetch unavailable | Bounded failure; never accepts unverified token |
| Refresh after sign-out revocation | Fails to create a new session |
| Unexpired access token retained after sign-out | Behavior matches documented offline-verification limitation |
| API request via direct port/ALB bypass | Same backend authentication/ownership enforcement |
| Reload auth test page | Signed out; no persistent tokens |

#### Technical notes

- Keep test signing keys separate from emulator keys. Neither should be treated as production trust material.
- Assert negative behavior at the public HTTP boundary and inspect persisted state after denied mutations.
- Use test-clock control for expiration rather than long sleeps; record emulator-specific gaps separately from verifier unit-test coverage.

#### Acceptance criteria

- [ ] Required matrix cases have automated tests or explicitly justified manual evidence.
- [ ] Real provider login, real database ownership, and complete gateway path are covered.
- [ ] CI failure is triggered by broken signature verification, missing owner predicate, or unavailable required dependency.
- [ ] Test logs/artifacts contain no tokens/passwords.
- [ ] Existing phase-1 checks and relevant web/MCP builds/tests remain green.
- [ ] Cleanup preserves unrelated projects and the normal local environment.

**Verification:** Introduce a temporary local negative condition to confirm a test fails, restore it, and rerun the affected suite.  
**Learning checkpoint:** Explain why a mocked guard cannot prove security, why denied writes require database assertions, and why emulator tests do not certify production AWS behavior.

## KT-0019

### Document, rehearse, and hand off the identity contract

**Parent:** KT-E002  
**Status:** Backlog  
**Type / estimate:** Task / 3 points  
**Depends on:** [KT-0018](#kt-0018)  
**Unblocks:** Phase 3 planning/implementation  
**Suggested branch:** `docs/KT-0019-auth-handoff`

**User story:** As a developer implementing financial features, I want a clear verified-user and ownership contract so I can add endpoints without reinventing authentication.

#### Deliverables and implementation tasks

1. Extend local-backend documentation with auth setup, synthetic users, canonical issuer/JWKS settings, and test-page startup.
2. Document the principal type, guard/public-route rules, `/v1/me` response, owner-scoped query examples, and error contract.
3. Explain pool reset versus database reset, stale tokens, user mapping recovery, and why email-based automatic linking is prohibited.
4. Record measured Floci compatibility, gateway enforcement, refresh behavior, logout limits, and any deferred recovery/signup features.
5. Run a fresh isolated setup followed by the final demonstration below.
6. Publish a phase-3 checklist: new ownership foreign keys, owner predicates, cross-user relationship validation, and transaction-scoped financial mutations.
7. Clearly mark the disposable ownership probe and auth test page as development facilities with future cleanup/retention decisions.
8. Record the browser production-auth decision as a phase-4 prerequisite, not an accidental commitment to the local harness design.

#### Technical notes

- Treat the authenticated principal and owner-scoped service method signatures as the contract consumed by phase 3.
- User-pool recreation is an identity change, not merely a URL/configuration change. Document its impact on existing local rows.
- The auth lab must remain independently runnable and must not become a second production frontend by accident.

#### Acceptance criteria

- [ ] Fresh setup produces working pool, users, mappings, protected API, and auth test page.
- [ ] Following docs alone reproduces Alice/Bob isolation and sign-out behavior.
- [ ] Exact versions and tested platforms are recorded.
- [ ] No implementation gap is hidden behind a completed checklist.
- [ ] Phase-3 developers have a concrete principal/owner-query contract.
- [ ] Existing production web/MCP/Supabase systems remain unchanged.

**Verification:** Complete the final demonstration and record commands/results, tested environment, and blockers in the PR evidence.  
**Learning checkpoint:** Explain the entire request from sign-in to owner-scoped SQL and where each failure is handled.

## 6. Proposed implementation locations and commands

Names below are proposed additions, not files/scripts that currently exist.

| Location | Responsibility |
|---|---|
| `apps/api/src/auth/` | Verifier, global guard, public/current-user decorators, principal |
| `apps/api/src/users/` | Application-user resolution and `/v1/me` |
| `apps/api/src/database/schema/` | Application-user and local probe schemas |
| `apps/api/src/dev/ownership-probes/` | Local/test-only authorization exercise |
| `apps/api/drizzle/` | Reviewed identity/probe migrations |
| `apps/api/test/auth/` | Token, guard, lifecycle, and isolation tests |
| `apps/auth-lab/` | Isolated local browser test page |
| `infra/terraform/local/` | Cognito and gateway authorizer resources |
| `scripts/local/auth/` | Synthetic users, smoke tests, controlled reset |
| `docs/adr/` | Auth and identity decisions |
| `docs/local-auth.md` | Setup, troubleshooting, identity contract |

| Proposed command | Responsibility |
|---|---|
| `pnpm local:auth:seed` | Prepare stable synthetic users idempotently |
| `pnpm local:auth:smoke` | Sign in, call API, verify two-user isolation |
| `pnpm auth-lab:dev` | Run isolated local auth page |
| `pnpm api:test:auth` | Fast verifier/guard tests |
| `pnpm api:test:auth:integration` | Real local provider/database/gateway suite |
| `pnpm local:auth:reset -- --confirm-local-auth-data-loss` | Explicit scoped identity reset with documented mapping consequences |

Integrate these with phase-1 setup rather than creating a second unrelated environment. Avoid commands that echo tokens or accept passwords in shell history. Keep any temporary credential/token files ignored, access-restricted, and cleaned up.

## 7. Definition of done and final demonstration

### Ticket definition of done

- Acceptance criteria met with recorded evidence.
- Technical decisions and compatibility deviations documented.
- Relevant tests/builds and repository-required checks pass.
- No production resources, secrets, or records used.
- API migrations, local config, and auth harness remain isolated from the deployed app.
- Implementing developer can explain the learning checkpoint.

### Final demonstration

1. Start the phase-1 environment and apply phase-2 local resources/migrations.
2. Seed Alice and Bob twice; demonstrate stable subjects and no duplicate users.
3. Sign in as Alice, call `/v1/me`, create a probe, and list it.
4. Sign in as Bob in a separate browser context; show a different internal user and no Alice records.
5. Attempt to read/update/delete Alice's probe as Bob; show 404 responses and unchanged database state.
6. Repeat protected requests through direct API, ALB, and gateway paths; backend checks must remain active.
7. Show rejection of an ID token, expired token, tampered token, wrong-client token, and forged identity header.
8. Refresh a session, then sign out; show local state clearing and refresh revocation behavior. Explain the residual access-token validity window.
9. Demonstrate that an in-flight refresh cannot restore a signed-out session.
10. Restart the environment, sign in again, and verify expected identity persistence.
11. Run the automated suites and demonstrate the existing web app still uses its original authentication flow.
12. Record limitations and phase-3/phase-4 follow-ups explicitly.

### Epic completion checklist

- [ ] KT-0010–KT-0019 complete against their acceptance criteria.
- [ ] Two synthetic users authenticate and map to stable distinct internal identities.
- [ ] Strict backend verification remains active on every reachable HTTP path.
- [ ] Owner-scoped CRUD isolation is proven with real database assertions.
- [ ] Gateway JWT enforcement is verified, or an explicit reduced-scope decision is recorded.
- [ ] Refresh, sign-out, and race behavior match the documented contract.
- [ ] No ID token or client-supplied owner identity can authorize data access.
- [ ] Fresh setup, CI, restart, and documentation agree.
- [ ] Actual finance authorization remains scheduled for phase 3, not claimed complete here.
- [ ] No production deployment, user migration, or frontend cutover occurred.

## 8. Blockers and follow-up decisions

| Risk | Detection | Response |
|---|---|---|
| Floci token/refresh operation differs from expected Cognito behavior | KT-0010 probe | Record exact behavior; adjust the local flow through an ADR or leave dependent acceptance blocked |
| Issuer is unreachable from Docker/gateway | Discovery/JWKS connectivity tests | Use explicit trusted local address mapping; never drop issuer/signature validation |
| Gateway accepts an ID token | Path-by-token matrix | Preserve mandatory Nest `token_use` checks; evaluate genuine application scopes in the future OAuth flow |
| Pool recreation changes identities | Reset rehearsal | Explicitly reset disposable mappings or perform a future deliberate migration; never join by email |
| Local fixture admin operations leak into browser | Bundle/config review | Keep admin setup in scripts; browser uses only public app client operations |
| Owner check exists only in controller/UI | KT-0015 database assertions | Enforce owner predicates in actual read/write queries |
| Sign-out expectations exceed offline validation behavior | Lifecycle tests | Document access expiry window; create a separate revocation-enforcement feature if needed |
| Frontend scope expands into a full migration | Ticket review | Keep auth lab separate; carry integration changes to phase 4 |

For a compatibility blocker, preserve a redacted reproducer and exact versions. Do not disable validation, fake success, or silently substitute another identity provider. A reduced-scope epic completion must record the changed requirement and a linked follow-up ticket.

## 9. Coding-agent handoff

This document is a backlog, not an instruction to implement every ticket in one change.

1. Read current repository instructions and verify predecessor evidence.
2. Start with the next ready ticket, using its technical notes and dependencies.
3. Preserve unrelated work and the current Supabase/web/MCP configuration.
4. Implement the bounded feature and its meaningful tests together.
5. Record the commands run, outcomes, compatibility decisions, and learning checkpoint.
6. Mark blocked requirements explicitly; do not turn security checks off to unblock an emulator test.
7. Do not create hosted resources, migrate production identities, merge, or deploy as part of this local epic.

Suggested PR evidence:

```markdown
## Ticket
KT-00XX — title; parent KT-E002

## Result
Concrete behavior now supported.

## Verification
Tests, commands, versions, and observed outcomes.

## Technical decisions
Issuer/JWKS handling, identity/ownership rules, or other relevant decisions.

## Limitations and follow-ups
Known gaps with ticket references, or None.

## Learning checkpoint
Short explanation in the developer's own words.
```

Creating this standalone plan does not create GitHub issues or modify the repository. Those actions require a separate request.

## 10. References and evidence limits

- [Phase 1 plan](phase-1-local-backend-foundation.md)
- [Kwartrack repository instructions](https://github.com/jcaburnay/kwartrack/blob/main/AGENTS.md)
- [Kwartrack product specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md)
- [Floci Cognito documentation](https://floci.io/floci/services/cognito/)
- [AWS: verifying Cognito JWTs](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)
- [AWS: Cognito access tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-access-token.html)
- [AWS: HTTP API JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [AWS JWT verification library](https://github.com/awslabs/aws-jwt-verify)

Documentation was consulted during planning on 2026-11-06. Recheck operation details against the pinned implementation versions. The tests and acceptance criteria above are project requirements and recommendations; no phase-2 implementation or runtime compatibility test has been performed merely by writing this file.
