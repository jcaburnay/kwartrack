# KT-E001 — Phase 1: Local Backend Foundation

**Project:** Kwartrack  
**Document version:** 1.0  
**Prepared:** 2026-11-06  
**Epic status:** Implemented and verified locally; GitHub CI and destructive reset rehearsal remain pending  
**Delivery format:** Standalone implementation plan; ticket IDs are planning identifiers, not existing GitHub issues.  
**Goal:** Learn NestJS and AWS integration by building a local alternative to the existing Supabase backend.

**Execution record (2026-11-10):** See the [implementation evidence](../../../docs/phase-1-evidence.md)
and [local setup guide](../../../docs/local-backend.md). The ticket checklists below
remain the acceptance baseline; the execution record identifies observed results
and outstanding verification rather than inferring completion from scaffolding.

## 1. Outcome and boundaries

At the end of this phase, a developer can start a NestJS API, provision emulated AWS resources, connect to real PostgreSQL through Floci RDS, apply isolated Drizzle migrations, and verify the API through an emulated gateway and load balancer.

The intended HTTP path is:

**Local client → API Gateway HTTP API → VPC Link → ALB → NestJS/Express**

NestJS connects separately to the PostgreSQL data endpoint returned by the emulated RDS service. Port 4566 is the AWS management endpoint, not the PostgreSQL connection endpoint.

The existing React application, MCP service, Supabase database, and hosted deployment continue to operate independently. This phase does not implement financial features or switch the frontend to the new API.

### Included

- `apps/api` workspace package, Express adapter, strict TypeScript, and injectable providers.
- Validated local configuration and explicit local endpoint handling.
- Docker Compose environment with pinned Floci and API images/builds.
- Terraform configuration for local RDS and routing resources.
- Drizzle database access, SQL migrations, and synthetic foundation fixtures.
- Liveness/readiness endpoints and minimal OpenAPI documentation.
- An early gateway/ALB compatibility experiment, followed by reproducible routing.
- Foundation tests, validation-only CI, startup/reset documentation, and final demonstration.

### Excluded

- Hosted AWS resources, production deployment, domain changes, or production data access.
- Cognito login flows, token validation, or user authorization: phase 2.
- Accounts, transactions, balances, transfers, and financial business logic: phase 3 onward.
- React API integration: phase 4.
- Recurring jobs, interest processing, and reporting: phase 5.
- Realtime and MCP migration: phase 6.
- Production data import or cutover: a later rehearsal and separate decision.
- ECS, Kubernetes, Redis, or additional databases merely for architectural completeness.

## 2. Decisions and recommendations

### Confirmed by the user

| Area | Decision |
|---|---|
| Frontend | Existing React, TypeScript, and Vite application |
| API | NestJS with its default Express adapter |
| Database | PostgreSQL through Floci RDS emulation |
| Database access | Drizzle ORM, `pg`, and Drizzle Kit |
| Authentication | Cognito through Floci; no Better Auth |
| API routing | Include API Gateway and an Application Load Balancer |
| Environment | Local-only first; decide on replacing production later |

### Recommended defaults, pending implementation review

| Area | Recommendation | Phase |
|---|---|---|
| Infrastructure as code | Terraform with explicitly configured local AWS service endpoints | 1 |
| API Gateway flavor | HTTP API (v2), HTTP proxy private integration to an ALB listener | 1 |
| Test tools | Vitest and Supertest; integration tests against real local PostgreSQL | 1 |
| API documentation | OpenAPI via NestJS Swagger, available locally | 1 |
| Realtime | Socket.IO on NestJS, connected through ALB separately from HTTP API routes | 6 |
| Scheduling | EventBridge Scheduler → SQS → NestJS worker, with idempotency and dead-letter handling | 5 |
| Object storage | S3 only when exports or another storage feature requires it | Later |

The recommendations are defaults for planning, not claims that every integration has been tested. Record any changes in a short architecture decision record (ADR). In particular, Socket.IO must not be assumed to work through an API Gateway WebSocket API: these are different protocols/integration models. Multi-instance realtime will require shared event distribution; defer that design until phase 6.

### Version policy

- Retain the repository's Node 24.x and pnpm 10.34.5 baseline unless the repository has changed when implementation begins.
- Pin compatible versions of NestJS packages, Drizzle, `pg`, Vitest, Floci, PostgreSQL, Terraform, and the Terraform AWS provider.
- Commit application lockfiles and Terraform's dependency lockfile. Do not use floating `latest` tags in the reproducible setup.
- Record the tested version matrix in the local setup documentation. Select exact versions during KT-0001/KT-0003 rather than guessing them in this plan.
- Verify Apple Silicon compatibility for the user's Mac mini and document the actual Docker platform tested. Do not claim Linux and macOS coverage unless both were exercised.

## 3. Repository baseline and constraints

The repository inspection found:

- `apps/web` and `apps/mcp` already exist in a pnpm workspace matching `apps/*`.
- Root `dev`, `build`, and `test` commands target the web app. Add API-specific commands without changing those meanings.
- Supabase currently owns authentication, database behavior, and transaction/account realtime notifications.
- Production SQL migrations live in `supabase/migrations` and are applied by CI when those paths change on `main`.
- `.github/workflows/ci.yml` deploys on pushes to `main`. Shared workspace file changes can also trigger MCP deployment.
- Biome is the existing formatting/lint tool. Do not introduce ESLint or Prettier.
- The repository requires strict TypeScript and prohibits explicit `any` and `@ts-ignore`.

Before implementing a ticket, reread the current `AGENTS.md`, `specs.md`, relevant package files, and CI configuration. This document is based on the inspected repository and does not override later repository changes.

Use an isolated worktree or branch for implementation. Do not merge to `main` as part of this phase's local demonstration. New migrations belong to the API package and must never be placed in `supabase/migrations`.

### Proposed file locations

| Path | Purpose |
|---|---|
| `apps/api/src/main.ts` | Application startup and shutdown |
| `apps/api/src/app.module.ts` | Root module |
| `apps/api/src/config/` | Configuration parsing and validation |
| `apps/api/src/database/` | Pool/provider, Drizzle schema, fixtures |
| `apps/api/src/health/` | Liveness and readiness endpoints |
| `apps/api/drizzle/` | Reviewed SQL migration history and metadata |
| `apps/api/test/` | API and database integration coverage |
| `apps/api/.env.example` | Placeholder local configuration |
| `apps/api/.env.local` | Ignored API-specific environment; separate from existing web setup |
| `infra/local/compose.yaml` | Local emulator and optional API containers |
| `infra/terraform/local/` | Local Terraform root and resource definitions |
| `scripts/local/` | Setup, provisioning, smoke tests, and controlled reset commands |
| `docs/adr/` | Short decision records and compatibility findings |
| `docs/local-backend.md` | Developer setup and troubleshooting |

Paths are proposed implementation locations. Creating this plan does not create those files in the repository.

## 4. Agile delivery workflow

Treat KT-E001 as the parent epic. The feature groups below organize the child tickets without adding unnecessary issue hierarchy.

| Feature group | Tickets | Demonstrable outcome |
|---|---|---|
| API foundation | KT-0001, KT-0002 | An independently runnable, configured NestJS API |
| Local infrastructure | KT-0003, KT-0004, KT-0007 | Reproducible database and HTTP routing |
| Persistence and health | KT-0005, KT-0006 | Verified database access and truthful readiness |
| Quality and handoff | KT-0008, KT-0009 | Repeatable checks and documented setup |

### Ticket lifecycle

**Backlog → Ready → In progress → Review → Done**

Use **Blocked** when an external dependency or emulator gap prevents acceptance. Keep a short blocker note, evidence, and the next action. Do not mark a ticket done merely because its code compiles.

- Work on one main ticket at a time. KT-0007 has an early investigation step so routing compatibility is checked before investing in all database work.
- Prefer one focused PR per ticket. A small documentation/test follow-up can accompany its originating ticket.
- Use Conventional Commit subjects and include the ticket ID in the PR title/body.
- Story points are relative complexity, not hours or deadlines. Re-estimate after the compatibility experiment.
- Suggested iteration A: KT-0001–KT-0003 plus the KT-0007 experiment.
- Suggested iteration B: KT-0004–KT-0006 plus KT-0007 completion.
- Suggested iteration C: KT-0008–KT-0009 and the phase demonstration.
- Iterations are outcome groups, not a promise to finish each in one week.

### Definition of ready

A ticket has a clear outcome, dependency status, acceptance criteria, known touchpoints, and a verification approach. Version or emulator uncertainty is explicitly called out rather than hidden in an estimate.

### Definition of done for every ticket

- Acceptance criteria met and evidence recorded.
- Relevant tests and builds pass; required repository checks pass.
- New configuration and behavior are documented.
- No production credentials, real financial records, generated build output, Terraform state, or local environment files are committed.
- No unrelated refactoring, changes to production Supabase migrations, or deployment activation.
- The developer can explain the learning checkpoint in their own words.

### PR evidence template

```markdown
## Ticket
KT-000X — title; parent KT-E001

## Behavior
What now works and why it matters.

## Verification
Commands executed, results, and environment/version details.

## Limitations
Known gaps and related ticket IDs, or None.

## Learning note
A short explanation of the main concept implemented.
```

## 5. Backlog and dependencies

| Ticket | Type | Priority | Points | Depends on |
|---|---|---|---:|---|
| [KT-0001](#kt-0001) — Scaffold API workspace | Task | High | 3 | — |
| [KT-0002](#kt-0002) — Configuration and local safeguards | Task | High | 3 | KT-0001 |
| [KT-0003](#kt-0003) — Floci and Docker networking | Task | High | 5 | KT-0002 |
| [KT-0004](#kt-0004) — Terraform and RDS PostgreSQL | Task | High | 5 | KT-0003 |
| [KT-0005](#kt-0005) — Drizzle, migrations, fixtures | Task | High | 5 | KT-0004 |
| [KT-0006](#kt-0006) — Health, API docs, lifecycle | Task | High | 3 | KT-0005 |
| [KT-0007](#kt-0007) — Gateway/ALB compatibility and routing | Spike + task | High | 8 | KT-0003 to investigate; KT-0006 to finish |
| [KT-0008](#kt-0008) — Foundation tests and validation CI | Task | High | 5 | KT-0006, KT-0007 |
| [KT-0009](#kt-0009) — Setup, reset, and handoff | Task | High | 3 | KT-0008 |

**Initial estimate: 40 points.** This is a planning baseline only. KT-0007 is the highest uncertainty; split it into linked follow-up tickets if the investigation shows substantial additional work. Do not renumber existing tickets.

The critical sequence is KT-0001 → KT-0002 → KT-0003 → KT-0004 → KT-0005 → KT-0006 → KT-0008 → KT-0009. KT-0007 begins after KT-0003 and must finish before KT-0008 closes.

## KT-0001

### Scaffold the NestJS API workspace

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 3 points  
**Depends on:** None  
**Unblocks:** [KT-0002](#kt-0002)  
**Suggested branch:** `feat/KT-0001-api-foundation`

**User story:** As a developer learning NestJS, I want an independently runnable API in the workspace so that backend work can proceed alongside the existing frontend.

#### Deliverables and tasks

1. Inspect workspace, Biome, release-version, and TypeScript conventions.
2. Create `@kwartrack/api` under `apps/api`; keep it private and align its initial version with repository conventions.
3. Configure NestJS with Express, a root module, and a health controller.
4. Add `GET /health/live`, initially returning HTTP 200 with `{"status":"ok"}`.
5. Add development, build, compiled-start, and test scripts plus root aliases.
6. Configure Vitest/Supertest. Verify the test transform supports Nest decorator behavior; use a compatible transformer or test compiled output if necessary. Do not assume Vite's default transform emits decorator metadata.
7. Add a small injectable provider exercised by the HTTP smoke test so the test checks dependency injection, not only a static response.
8. Document direct API startup and the chosen package versions.

#### Acceptance criteria

- [ ] API starts without PostgreSQL, Supabase, or Floci at this scaffolding stage.
- [ ] `pnpm api:dev` listens on the configured port, initially 3000.
- [ ] Health endpoint returns the documented response.
- [ ] `pnpm api:build`, compiled start, and `pnpm api:test` work.
- [ ] Test and built application both resolve the injectable provider correctly.
- [ ] Existing root web/MCP commands keep their meaning.
- [ ] New code follows strict TypeScript and Biome conventions.
- [ ] No deployment or production migration configuration is introduced.

#### Verification and learning checkpoint

Run the API HTTP smoke test, compile and start the output, then confirm shutdown releases the port. Run relevant workspace checks, including release alignment after package changes.

Explain the roles of `NestFactory`, modules, controllers, providers, dependency injection, and decorator metadata. Explain why a dev-server success alone does not validate the compiled application.

## KT-0002

### Establish configuration and explicit local endpoints

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 3 points  
**Depends on:** [KT-0001](#kt-0001)  
**Unblocks:** [KT-0003](#kt-0003)  
**Suggested branch:** `feat/KT-0002-local-config`

**User story:** As a developer, I want one validated local configuration contract so that invalid settings fail clearly and experimental commands target the intended environment.

#### Deliverables and tasks

1. Define an explicit environment mode such as `APP_ENV=local`; do not infer local infrastructure solely from `NODE_ENV`.
2. Create an injectable configuration provider, with validation and useful errors that omit secret values.
3. Establish API port/bind settings, database connection settings, AWS management endpoint, region, and dummy credentials.
4. Separate host-facing addresses from Docker-network addresses. `localhost` inside an API container is not the host or Floci container.
5. Use `apps/api/.env.local` and an example file; never overwrite the existing frontend `.env.local` generated by `pnpm bootstrap`.
6. Add local command preflight checks: reject hosted AWS endpoints, unknown database hosts, and missing local mode. Permit only explicit loopback/development Docker addresses needed by the topology.
7. Terraform wrappers must set dummy credentials explicitly, avoid inherited AWS profiles/session tokens, disable metadata credential lookup, and configure every service endpoint used. Provider validation-skip flags alone are not endpoint isolation.
8. Choose an explicit environment-loading strategy for tests, development, compiled execution, and Compose; document precedence.

#### Acceptance criteria

- [ ] Valid configuration loads consistently in development and compiled runs.
- [ ] Missing or malformed required settings produce a clear, redacted error.
- [ ] Local provisioning/migration commands reject a deliberately supplied hosted endpoint before making requests.
- [ ] Generated configuration is ignored by git and does not contain production values.
- [ ] Host and container connection examples are distinct and documented.
- [ ] Existing frontend/MCP environment behavior remains unchanged.

#### Verification and learning checkpoint

Test parsing and rejection cases without contacting remote services. Check that error output excludes credentials. Database settings become mandatory for full application readiness when KT-0005 is integrated; this ticket must not require a running database to validate configuration.

Explain configuration versus code, Nest provider injection, and why an AWS SDK endpoint and a database URL serve different purposes.

## KT-0003

### Configure Floci, Docker networking, and persistence

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 5 points  
**Depends on:** [KT-0002](#kt-0002)  
**Unblocks:** [KT-0004](#kt-0004), early [KT-0007](#kt-0007) experiment  
**Suggested branch:** `feat/KT-0003-local-emulator`

**User story:** As a developer, I want a reproducible emulator environment that the API can reach from both host development and containerized integration tests.

#### Deliverables and tasks

1. Pin a Floci release/image and record its supported PostgreSQL engine/container configuration.
2. Create `infra/local/compose.yaml` with a named network and project-scoped persistent storage.
3. Provide access to the Docker daemon required for real RDS backend containers; document the trust implication of mounting its socket and the supported local runtime.
4. Publish management and required data/listener ports to loopback where supported. Document and verify any dynamically created container/port exposure.
5. Reserve a nonconflicting RDS proxy/listener range based on the pinned release. Avoid the existing Supabase ports, Vite port, and API development port.
6. Add an API container build/profile for routing tests; retain a fast host-run development option.
7. Define bounded startup/readiness probes, logs, and clear errors for Docker unavailable, port conflicts, and failed image pulls.
8. Document stop/start versus destructive reset. Persist emulator state and actual database volumes; one does not automatically guarantee the other.
9. Verify arm64 image availability on the Mac mini; record any emulation overhead if an amd64 fallback is needed.

#### Acceptance criteria

- [ ] Emulator starts via the documented command and accepts an AWS management request.
- [ ] API container and host tools can reach the correct emulator endpoints.
- [ ] No AWS account or hosted credentials are needed; initial package/image downloads may still require internet.
- [ ] Existing Supabase containers are not stopped, removed, or reused by these scripts.
- [ ] The documented stop command preserves volumes/state.
- [ ] Missing Docker or a port conflict produces an actionable, bounded failure.
- [ ] Tested host architecture, Docker runtime, image versions, network, and ports are recorded.

#### Verification and learning checkpoint

Start, stop, and restart the stack; check service reachability from host and API container. Inspect only this Compose project's resources. Persistent SQL data is tested after KT-0004/KT-0005.

Explain Docker DNS, bridge networks, published ports, volumes, and why an emulated AWS subnet does not necessarily provide actual VPC network isolation.

## KT-0004

### Provision local RDS PostgreSQL with Terraform

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 5 points  
**Depends on:** [KT-0003](#kt-0003)  
**Unblocks:** [KT-0005](#kt-0005)  
**Suggested branch:** `feat/KT-0004-local-rds`

**User story:** As a developer learning AWS, I want Terraform-managed RDS resources backed by a real local PostgreSQL engine so that I can practice provisioning and SQL independently.

#### Deliverables and tasks

1. Create a local-only Terraform root with pinned CLI/provider versions and committed provider lockfile.
2. Use local Terraform state, ignored by git. Do not add hosted state storage or hosted AWS credentials.
3. Configure RDS, EC2/networking, and any other provider endpoints the resources actually use. Apply the KT-0002 safeguards.
4. Define the minimal RDS instance, engine version, database name, and necessary emulated VPC/subnet/security-group resources. Avoid constructing NAT gateways or unrelated infrastructure.
5. Enable the real database backend, not metadata-only/mock RDS mode.
6. Output resource identifiers and connection information; keep passwords sensitive and generated credentials out of committed files/logs.
7. Generate appropriate host/container connection settings from discovered endpoints rather than guessing port 5432 or using port 4566.
8. Prove readiness with a PostgreSQL connection and `SELECT 1`, not only an RDS status of `available`.
9. Implement bounded retries and document state reconciliation after emulator reset.

#### Acceptance criteria

- [ ] Terraform init/validate/plan/apply work against Floci.
- [ ] An unchanged second plan has no unexpected resource changes.
- [ ] A SQL client connects and executes a real PostgreSQL query.
- [ ] API execution environments can resolve their generated database endpoint.
- [ ] A disposable probe record survives a documented non-destructive restart.
- [ ] State, credentials, and generated connection files are ignored by git.
- [ ] Local destroy targets only this experiment's resources and clearly documents data loss.
- [ ] No fallback to plain PostgreSQL silently substitutes for RDS emulation; any fallback is recorded as a limitation requiring a scope decision.

#### Verification and learning checkpoint

Record the Terraform plan result, SQL probe, endpoint discovery, and restart evidence. Treat control-plane success without SQL connectivity as a failure.

Explain RDS control plane versus data plane, Terraform state versus actual resources, and why Terraform provisions a database service while migrations manage application tables.

## KT-0005

### Integrate Drizzle, migrations, and synthetic fixtures

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 5 points  
**Depends on:** [KT-0004](#kt-0004)  
**Unblocks:** [KT-0006](#kt-0006)  
**Suggested branch:** `feat/KT-0005-drizzle-foundation`

**User story:** As a developer, I want typed database access and repeatable migrations so that future features have a reliable persistence foundation.

#### Deliverables and tasks

1. Create a `DatabaseModule` exposing a single `pg` pool and typed Drizzle database provider.
2. Configure bounded pool/connection/query timeouts and graceful connection cleanup.
3. Add Drizzle Kit configuration and migration scripts using the guarded API-local database URL.
4. Use generated, reviewed SQL migrations and a migration ledger; avoid relying on schema push as the normal workflow.
5. Add a minimal foundation fixture table, such as `dev_fixture`, in a clearly documented development schema. Do not invent the full finance/user model in phase 1.
6. Seed a deterministic synthetic record with idempotent upsert behavior. The seed must not truncate unrelated data.
7. Add a transactional integration probe that writes and rolls back, and a test verifying committed data can be reread.
8. Explain future migration of Supabase-specific functions, auth dependencies, and triggers as separate work. Do not copy the existing Supabase migrations wholesale into the new database.
9. Add root aliases for generation, migration, seeding, and integration tests without replacing existing Supabase commands.

#### Acceptance criteria

- [ ] Empty local database can be migrated and seeded from documented commands.
- [ ] Repeating migration and seed commands creates no duplicate fixtures or unintended changes.
- [ ] Drizzle successfully reads and writes through the injected provider.
- [ ] A rollback test proves a failed transaction leaves no partial fixture writes.
- [ ] Reviewed SQL migrations are committed under `apps/api/drizzle`, outside Supabase paths.
- [ ] Pool connections close during shutdown/test teardown.
- [ ] Database operations do not automatically run migrations on every API request or startup.
- [ ] No real financial data, hosted credentials, or copied password hashes enter fixtures.

#### Verification and learning checkpoint

Test from an empty database, rerun migrations/seed, test commit/rollback, and restart to confirm fixture persistence. Full authorization and financial correctness tests belong to later phases.

Explain providers versus repositories, Drizzle schema versus SQL migrations, pooling, transactions, and why transaction boundaries must cover an entire business operation.

## KT-0006

### Implement truthful health checks, lifecycle handling, and API docs

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 3 points  
**Depends on:** [KT-0005](#kt-0005)  
**Unblocks:** completion of [KT-0007](#kt-0007), [KT-0008](#kt-0008)  
**Suggested branch:** `feat/KT-0006-api-health`

**User story:** As a developer, I want to distinguish a running process from a database-ready service and diagnose failures without exposing internal credentials.

#### Deliverables and tasks

1. Retain dependency-free `GET /health/live`: 200 when the HTTP process is responsive.
2. Implement `GET /health/ready`: bounded database connectivity and expected foundation-schema/migration readiness check; 200 when usable, 503 when unavailable or not migrated.
3. Return a minimal error payload; log useful redacted diagnostics separately.
4. Enable graceful shutdown so the listener and database pool close.
5. Add basic request correlation, status/duration logging, and a local-only configurable instance ID for routing tests. Do not log authorization headers or connection strings.
6. Publish minimal OpenAPI docs for health endpoints; keep Swagger exposure local-only.
7. Set explicit local CORS origins if needed for smoke testing. Do not add wildcard credentialed CORS.
8. Document proxy headers and use a constrained trust-proxy setting if required; do not globally trust arbitrary forwarded headers without reviewing the proxy path.

#### Acceptance criteria

- [ ] Liveness succeeds without querying the database.
- [ ] Readiness returns 200 only when the expected database/schema is usable.
- [ ] Database unavailable/unmigrated scenarios return 503 within a defined timeout.
- [ ] Restoring the database allows readiness to recover without manual code changes.
- [ ] Responses and logs exclude secrets and internal stack traces.
- [ ] Compiled API shuts down cleanly and releases resources.
- [ ] OpenAPI reflects the actual health responses.

#### Verification and learning checkpoint

Exercise healthy, stopped-database, unmigrated-database, and recovery cases; assert status codes and timeout bounds. Explain liveness versus readiness, why dependency failure should not make liveness fail, and why a load balancer should use a meaningful readiness signal.

## KT-0007

### Prove API Gateway → VPC Link → ALB → NestJS routing

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Spike plus implementation / High / 8 points  
**Start after:** [KT-0003](#kt-0003), using KT-0001's lightweight health endpoint  
**Finish after:** [KT-0006](#kt-0006)  
**Unblocks:** [KT-0008](#kt-0008)  
**Suggested branch:** `feat/KT-0007-local-api-routing`

**User story:** As a developer learning AWS networking, I want the API reachable through the intended emulated infrastructure so that I can understand gateway integrations, listeners, and target groups.

#### Step A — early compatibility experiment

Timebox the first investigation to one focused learning session, approximately 2–4 hours of implementation effort. This is an investigation budget, not a promise of successful integration.

1. Read the pinned Floci version's HTTP API private-integration and ELB documentation.
2. Create the smallest working HTTP API, VPC Link, ALB listener, target group, and target registration.
3. Register a reachable API container address using the supported IP/target mechanism. Record how restarts update target addresses; avoid hardcoded ephemeral IPs.
4. Call the health endpoint directly, through ALB, and through API Gateway.
5. Record exact requests, resource types, version, routing behavior, and any emulator limitations in an ADR.

**Investigation exit:** Either demonstrate the complete path, or document a reproducible blocker and proposed alternative. If blocked, do not silently replace the topology and declare success. Database tickets can continue while the routing decision remains open. A direct HTTP integration can be a temporary diagnostic path, but does not satisfy the agreed private-integration acceptance criteria.

#### Step B — reproducible implementation

1. Codify the proven routing resources in Terraform, reusing local network resources rather than independently owning duplicate definitions.
2. Configure an HTTP API (v2), proxy integration referencing the ALB listener, routes/stage, VPC Link, ALB, target group, and listener.
3. Verify path mapping explicitly: `/health/ready` must reach Nest unchanged, including any API stage prefix handling.
4. Use readiness for target health where the emulator implements it. Record observed behavior instead of claiming AWS-equivalent enforcement.
5. Make target registration deterministic across container restarts. Choose a documented network/address strategy or controlled refresh step.
6. Add a second API instance only in a smoke-test profile; identify responses with local instance IDs and demonstrate both targets receive requests.
7. Provide discovered direct/ALB/gateway URLs as local outputs and a smoke-test script.
8. Verify status-code and query-string forwarding; use a temporary test-only echo fixture if needed, not a permanent public debug endpoint.
9. Document target-down behavior, reconnection, and any unsupported health/failover details.

#### Acceptance criteria

- [ ] The compatibility ADR contains the tested version and a complete-path result.
- [ ] Terraform recreates routing without manual console steps.
- [ ] Gateway invocation traverses the private integration and ALB rather than bypassing them.
- [ ] Direct, ALB, and gateway health responses have the expected status/path behavior.
- [ ] Across repeated requests, both API instances receive traffic in the optional two-instance profile; no claim of exact balancing order is required.
- [ ] Restarted targets become reachable through the documented registration/reconciliation process.
- [ ] An unchanged Terraform plan has no unexplained drift.
- [ ] Resource creation, routing, balancing, and target-health behavior are reported separately.
- [ ] Any unsupported requirement remains explicitly blocked or is changed through a recorded scope decision.

#### Verification and learning checkpoint

Capture calls to each hop, correlation/instance evidence, and behavior with one target stopped. The second target test is for understanding load distribution, not production capacity testing.

Explain HTTP API versus REST API, API Gateway versus ALB, VPC Link versus real network reachability, listener versus target group, and why API Gateway is not where NestJS executes. NestJS runs in local processes/containers; ECS is not required for this phase.

## KT-0008

### Consolidate foundation tests and validation-only CI

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 5 points  
**Depends on:** [KT-0006](#kt-0006), [KT-0007](#kt-0007)  
**Unblocks:** [KT-0009](#kt-0009)  
**Suggested branch:** `test/KT-0008-foundation-ci`

**User story:** As a developer, I want automated evidence that the new foundation works without provisioning hosted resources or changing existing application behavior.

#### Deliverables and tasks

1. Organize the focused tests already introduced; do not duplicate them merely to fill a testing ticket.
2. Separate fast configuration/API tests from database and emulator integration suites.
3. Cover local endpoint rejection, health failure/recovery, migration/seed repeatability, rollback, resource startup, and gateway routing.
4. Use isolated project/database identifiers for tests. Never reset the developer's main local database as incidental test cleanup.
5. Fail explicitly when an integration suite requested by CI lacks Docker or its required services. Do not report a skipped integration suite as a pass.
6. Add an independent API validation workflow on pull requests and/or manual dispatch. Use dummy local settings, read-only repository permissions, and no deployment secrets/OIDC cloud role.
7. Include type-check/build, tests, Biome, Terraform formatting/validation, and the supported emulator smoke suite.
8. Preserve existing production workflow behavior. Document that merging shared workspace changes to `main` can still trigger existing deployments; an API-only validation workflow does not neutralize those triggers.
9. Ensure cleanup uses exact test resource/project identities and preserves useful redacted diagnostics on failure.
10. Verify compiled builds in addition to the Vitest pipeline to detect decorator/module-resolution differences.

#### Acceptance criteria

- [ ] Fast and integration commands are distinct and documented.
- [ ] CI exercises actual PostgreSQL and the validated routing path, or reports an explicit unresolved runner limitation rather than a green placeholder.
- [ ] Failed database connectivity or routing makes the relevant check fail.
- [ ] Tests cannot reset unrelated Supabase/developer resources.
- [ ] Existing web and MCP tests/builds and release checks pass after workspace changes.
- [ ] New validation jobs do not deploy or use hosted AWS credentials.
- [ ] Failure logs are useful and redacted; cleanup runs even after a test failure.

#### Verification and learning checkpoint

Run the same documented commands locally and on the chosen CI runner. Intentionally break a local dependency to confirm failure is detected, then restore it and rerun the affected check.

Explain unit versus integration versus end-to-end infrastructure tests, deterministic test data, and why mock-only tests cannot prove network routing or SQL transactions.

## KT-0009

### Complete setup, reset, troubleshooting, and phase handoff

**Parent:** KT-E001  
**Status:** Backlog  
**Type / priority / estimate:** Task / High / 3 points  
**Depends on:** [KT-0008](#kt-0008)  
**Unblocks:** KT-E002 / phase 2 authentication planning  
**Suggested branch:** `docs/KT-0009-local-backend-handoff`

**User story:** As a developer returning to the project, I want one documented workflow to recreate, run, diagnose, and reset the local backend without relying on remembered manual steps.

#### Deliverables and tasks

1. Write `docs/local-backend.md` with prerequisites, versions, port/network table, commands, expected responses, and architecture responsibilities.
2. Implement an idempotent setup orchestration command with dependency order: preflight → emulator → Terraform → database connectivity → migration → seed → API → routing smoke test.
3. Distinguish image/package downloads from normal local execution; local-only does not mean first-time installation works offline.
4. Document host development and containerized verification modes, and how to avoid running two APIs on the same port.
5. Document preserve-data stop/start separately from destructive reset. Reset requires an explicit flag and prints exactly which local resources/state/volumes will be removed.
6. Define recovery for a lost emulator state file with retained Terraform state, and the reverse. Do not prescribe deleting all Docker volumes or global Terraform state.
7. Document SQL endpoint discovery, Docker daemon issues, port conflicts, missing migrations, stale target registration, and gateway path mismatch.
8. Add a repository README pointer without replacing the existing Supabase onboarding route.
9. Perform a fresh-checkout rehearsal in an isolated test project; record actual results and machine/runtime details.
10. Summarize remaining decisions for phase 2, including application user identity mapping to Cognito `sub` and later removal of Supabase-auth assumptions.

#### Acceptance criteria

- [ ] A clean checkout reaches the working gateway endpoint using only documented steps.
- [ ] Running setup again is safe and does not duplicate fixtures or resources.
- [ ] Non-destructive restart preserves the synthetic fixture and restores routing.
- [ ] Explicit reset recreates a clean, working local environment and leaves existing Supabase resources untouched.
- [ ] Version matrix, known emulator gaps, and tested platforms are documented honestly.
- [ ] The final demonstration and checklist below are complete, with blockers visible.
- [ ] No production cutover, GitHub issue creation, or merge is implied by completing this plan.

#### Verification and learning checkpoint

Walk through the README as if starting fresh, without undocumented manual fixes. Explain the startup dependency order, state recovery, and the difference between building a local replacement and migrating production.

## 6. Proposed command contract

These commands are desired deliverables, not commands already present in the repository. Implement them with consistent help and exit codes; rename only if documented throughout the plan and setup guide.

| Command | Expected responsibility |
|---|---|
| `pnpm api:dev` | Run API with local configuration and watch mode |
| `pnpm api:build` | Type-check and compile API |
| `pnpm api:start` | Run compiled API |
| `pnpm api:test` | Fast API/configuration tests |
| `pnpm api:test:integration` | Isolated real-database tests |
| `pnpm api:db:generate` | Generate reviewable SQL migration files |
| `pnpm api:db:migrate` | Apply pending API-local migrations |
| `pnpm api:db:seed` | Load idempotent synthetic foundation fixtures |
| `pnpm local:up` | Start emulator/dependencies, preserving state |
| `pnpm local:plan` | Guarded local Terraform plan |
| `pnpm local:apply` | Guarded local Terraform apply |
| `pnpm local:setup` | Complete idempotent setup sequence |
| `pnpm local:smoke` | Direct, ALB, gateway, and database probes |
| `pnpm local:down` | Stop this stack without deleting data |
| `pnpm local:reset -- --confirm-local-data-loss` | Explicit project-scoped destructive reset |

Do not change `pnpm bootstrap`, `pnpm dev`, or Supabase reset semantics as part of this phase.

## 7. Main risks and decision gates

| Risk | Detection | Response |
|---|---|---|
| Private integration is unsupported or broken in the chosen Floci version | Early KT-0007 experiment | Record reproducer; try a justified pinned-version change or request a topology decision; do not claim complete routing |
| RDS resource exists but SQL is not usable | SQL probe in KT-0004 | Inspect backend Docker/container/proxy readiness; reject metadata-only success |
| Host/container addresses differ | KT-0003 reachability tests | Generate separate connection configuration and document network ownership |
| Vitest and production decorator transforms differ | KT-0001 injection smoke and KT-0008 compiled checks | Use a compatible transform strategy or compiled-output testing |
| API setup accidentally invokes existing deployment paths | CI review in KT-0008 | Keep work isolated; add validation-only jobs; separately review any eventual merge |
| Emulator or Terraform state is reset independently | Restart/reset rehearsal | Document scoped reconciliation and resource lifecycle; protect unrelated volumes |
| Mac mini memory pressure | Startup observation | Keep default one API instance; enable second instance only for routing tests; avoid running unused Supabase services simultaneously unless needed |
| Later auth schema conflicts with foundation fixtures | KT-0005 scope review | Keep dev fixtures separate; design real user/Cognito mapping in phase 2 |

**Gate A:** API scaffolding and local environment work.  
**Gate B:** Complete routing compatibility is demonstrated or a scope decision is recorded.  
**Gate C:** PostgreSQL migrations, readiness, restart, and integration tests work.  
**Gate D:** Fresh-checkout rehearsal passes and all unresolved gaps are explicit.

If an agreed acceptance criterion remains blocked, the epic is not fully done. A reduced-scope completion requires recording the changed criterion and the deferred follow-up ticket.

## 8. Final demonstration and epic acceptance

Demonstrate in this order:

1. Start from an isolated fresh checkout and run setup using only the documented commands.
2. Show Terraform resources and an unchanged second plan.
3. Connect to PostgreSQL, show the expected migrated schema and synthetic fixture.
4. Call liveness and readiness directly, through ALB, and through API Gateway.
5. Enable two API instances and demonstrate both receive requests through the ALB path.
6. Stop the database and demonstrate liveness remains responsive while readiness fails; restore it and show recovery.
7. Perform a non-destructive restart and show fixture persistence and restored routing.
8. Run relevant tests/builds and the explicit local smoke suite.
9. Demonstrate an explicit destructive reset only in the disposable test project, then recreate it.
10. Summarize what phase 2 will add and which production systems have not been switched.

### Epic checklist

- [ ] KT-0001 through KT-0009 meet their acceptance criteria.
- [ ] Complete gateway/private-link/ALB routing is verified against recorded versions.
- [ ] Actual PostgreSQL connectivity, migrations, rollback, and persistence are verified.
- [ ] Local settings are isolated from hosted environments.
- [ ] Existing web/MCP behavior and Supabase migration files remain intact.
- [ ] Integration tests have not silently skipped essential infrastructure checks.
- [ ] Documentation matches the tested environment and commands.
- [ ] No deployment or production replacement has been performed.
- [ ] Recommended future architecture choices remain clearly distinguished from implemented features.

## 9. Handoff instructions for a coding agent

This document is an implementation backlog, not an instruction to complete all phases in one change. When implementation is requested:

1. Read current repository instructions and inspect working-tree changes.
2. Start with the next ready ticket and preserve unrelated user work.
3. Confirm dependencies through evidence rather than checklist assumptions.
4. Implement only the ticket's bounded scope and relevant tests.
5. Record results and blockers, then update its status.
6. Keep the early KT-0007 compatibility experiment visible in the execution order.
7. Do not create hosted infrastructure, migrate production data, merge, or deploy as part of the local phase.

Creating this standalone document does not authorize creating GitHub issues or modifying the repository. Those actions can be requested separately.

## 10. Reference material

Repository evidence inspected during planning:

- [Kwartrack README](https://github.com/jcaburnay/kwartrack/blob/main/README.md)
- [Repository agent instructions](https://github.com/jcaburnay/kwartrack/blob/main/AGENTS.md)
- [Product specification](https://github.com/jcaburnay/kwartrack/blob/main/specs.md)
- [Root package configuration](https://github.com/jcaburnay/kwartrack/blob/main/package.json)
- [Workspace configuration](https://github.com/jcaburnay/kwartrack/blob/main/pnpm-workspace.yaml)
- [Current CI/deployment workflow](https://github.com/jcaburnay/kwartrack/blob/main/.github/workflows/ci.yml)

Official documentation supporting compatibility investigation; verify against the pinned versions during implementation:

- [Floci API Gateway](https://floci.io/floci/services/api-gateway/)
- [Floci ELB v2](https://floci.io/floci/services/elb/)
- [Floci RDS](https://floci.io/floci/services/rds/)
- [Floci Terraform setup](https://floci.io/floci/getting-started/terraform/)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions)
- [NestJS database overview](https://docs.nestjs.com/data/overview)

The proposed tickets and acceptance criteria are project recommendations. Documentation availability is not evidence that the full Kwartrack integration has already been implemented or tested.
