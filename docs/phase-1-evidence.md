# Phase 1 implementation evidence

Recorded 2026-11-10 on `feat/api-phase-1`, in the existing workspace. The foundation
was committed as `49c40ce`; the Phase 2 branch includes it. No hosted deployment,
production migration, or financial data import was performed. This record describes
Phase 1 verification; subsequent auth work is documented in [local-auth.md](local-auth.md).

## Delivery status

| Ticket | Evidence/status |
| --- | --- |
| KT-0001 | Nest/Express workspace, compiled dependency-injection tests, development/compiled startup and listener shutdown verified |
| KT-0002 | Explicit local configuration, host/container endpoint rules, redacted validation, API-only environment verified |
| KT-0003 | Floci 2.4.0 on arm64, dedicated Compose project/network, real PostgreSQL containers and persistence verified |
| KT-0004 | Terraform 1.13.4/provider 6.20.0, real RDS SQL endpoint, repeat apply/no-change plan verified |
| KT-0005 | Reviewed Drizzle migration, deterministic seed, commit/reread and rollback verified on isolated test databases |
| KT-0006 | Liveness, migration-aware readiness, bounded dependency failure/recovery, OpenAPI and correlation verified |
| KT-0007 | Gateway → VPC Link → ALB → Nest, status/query/header forwarding, two-target balancing and recovery verified |
| KT-0008 | Local checks pass; validation-only workflow added; its first GitHub-hosted run remains pending |
| KT-0009 | Complete setup rerun and stop/start persistence verified; destructive reset guards pass; actual reset rehearsal awaits explicit approval |

The API has no authentication or financial endpoints yet. Phase 2 begins that
work; the existing Supabase web/MCP application remains the active product path.

## Verification run

| Command/check | Observed result |
| --- | --- |
| `pnpm api:test` | 22 passed; imports TypeScript-compiled production modules |
| `pnpm api:test:integration` | 5 passed against real Floci RDS, using a new disposable database |
| `pnpm local:test` | 9 passed; local endpoint/credential guards and real HTTP retry/failure behavior |
| `pnpm local:setup` | Provisioning, migration, seed, API container startup and all three HTTP paths passed together |
| `pnpm local:smoke` | Direct/ALB/gateway live+ready 200; unknown route 404; correlation and decoded query forwarding preserved |
| Two-target smoke | Both instances receive traffic; stopped target excluded; restarted target rejoins; single-target topology restored |
| Stop/setup persistence | Synthetic SQL probe survived restart; API and routing recovered; temporary probe removed |
| Terraform fmt/validate/plan | Formatting and validation passed; plan reported no changes |
| `pnpm run ci` / `pnpm release:check` | Passed |
| `pnpm test` | 406 passed, 94 skipped by existing suite conditions |
| `pnpm mcp:test` | 20 passed, 2 skipped by existing suite conditions |
| `pnpm build` / `pnpm mcp:build` | Passed |
| `pnpm mcp:worker:build` | Dry-run passed; no deployment |
| Development and compiled process startup | `/health/live` 200 with no DB configured; SIGTERM released the test port |
| `git diff --check` | Passed |

Readiness was tested before migrations, after migrations, during pool exhaustion,
after releasing connections, and after closing the pool. During the bounded
approximately two-second dependency failure, liveness still returned 200.

An independent code review found no confirmed major correctness/security issue.
Its reset inventory and state-loss runbook gaps were addressed. Proxy startup
readiness now has bounded retries with real HTTP tests, and stop/start persistence
was exercised to resolve the review's restart question.

## Remaining verification

- The GitHub workflow has not run on a Linux runner. macOS/arm64 local evidence
  does not certify Linux or hosted AWS behavior.
- Actual destructive reset execution remains unverified. It deletes local
  databases/volumes/state and requires explicit authorization when needed.

See the [setup/runbook](local-backend.md) and
[routing decision and compatibility evidence](adr/phase-1-routing.md). The latter
records an initial missing API Gateway v2 endpoint configuration and its guarded
correction; it is not claimed as an uneventful compatibility pass.
