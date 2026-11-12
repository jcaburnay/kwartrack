# Local NestJS backend

Phase 1 adds an independent local API. The React app and MCP Worker still use
Supabase. This setup does not migrate users or financial records and does not
deploy anything.

## Prerequisites and tested versions

| Component | Version |
| --- | --- |
| Host Node | 24.22.1 (repository supports Node 24.x) |
| pnpm | 10.34.5 |
| Nest common/core/Express adapter | 12.4.2 |
| Nest Swagger | 12.1.1 |
| TypeScript / Vitest / Supertest | 6.0.2 / 4.1.2 / 7.3.2 |
| Drizzle ORM / Kit / pg | 0.45.4 / 0.31.11 / 8.23.1 |
| Floci | 2.4.0 |
| PostgreSQL | 16.6-alpine |
| Terraform / AWS provider | 1.13.4 / 6.20.0 |
| Docker engine tested | 29.9.2, Linux arm64 through Docker Desktop on macOS arm64 |

Install Node 24, the repository-pinned pnpm, Docker Desktop, AWS CLI v2, and
`unzip`. Keep the Docker engine running. Terraform can be installed into this
repository's ignored tools directory using the command below; it checks the
archive against HashiCorp's published SHA-256 checksums. An existing exact-version
installation or an explicit `TERRAFORM_BIN` path also works.

Floci mounts the Docker daemon socket so it can create real PostgreSQL containers.
That grants the emulator control of the local Docker engine. Use this development
setup only on a machine where that access is appropriate. Provisioning VPC and
security-group metadata in an emulator does not establish real AWS isolation.

## Start the complete local backend

```sh
pnpm install --frozen-lockfile
pnpm local:tools:terraform
pnpm local:setup
pnpm local:status
```

Setup checks the tools, starts Floci, applies local Terraform, discovers the RDS
data endpoint, writes API-only local settings, migrates and seeds PostgreSQL,
builds/starts the API container, waits for readiness, and tests all three HTTP
paths. Running setup again preserves existing data and repeats migration/seed
safely. Initial image, package, and provider downloads require internet access.

Local resources use the Compose project/network `kwartrack-backend-local`.
The dedicated Docker subnet is `172.29.240.0/24`; a conflicting existing subnet
must be resolved before setup. Other Docker projects and Supabase are not reset.

| Address | Purpose |
| --- | --- |
| `http://127.0.0.1:3000/health/live` | Dependency-free HTTP liveness |
| `http://127.0.0.1:3000/health/ready` | Database and foundation-migration readiness |
| `http://127.0.0.1:3000/docs` | Local Swagger UI |
| `http://127.0.0.1:3000/docs-json` | OpenAPI contract |
| `http://127.0.0.1:4566` | AWS management endpoint |
| `127.0.0.1:7001` initially | Discovered PostgreSQL proxy; reserved range 7001–7004 |
| `127.0.0.1:8080` | ALB listener, with the generated ALB hostname in the Host header |

`pnpm local:smoke` discovers the current API ID and ALB hostname. The browser/host
gateway URL has the form
`http://127.0.0.1:4566/execute-api/<api-id>/$default/health/live`.
The management port and PostgreSQL proxy are distinct protocols/endpoints.

The API containers have stable project-network addresses so Terraform target
registration survives container replacement. Container PostgreSQL connections use
`floci:<discovered-port>`; host connections use `127.0.0.1:<discovered-port>`.
Do not substitute `localhost` inside a container for another container's address.

## Configuration and host development

`apps/api/.env.example` documents API settings. Setup creates ignored,
mode-600 `apps/api/.env.local` and `infra/local/backend.env.local`; the existing
root web `.env.local` is untouched. Database passwords and Terraform state remain
local and ignored. Never copy these files into a commit or CI artifact.

API start/dev/migration/seed commands load `.env.local` relative to `apps/api`.
Existing process environment values take precedence over the file. Tests pass
explicit configuration or load the API-local file for database integration.
`APP_ENV=local` is mandatory. AWS endpoints must be allowlisted local addresses;
the region is `us-east-1` and credentials are dummy `test` values. The API rejects
inherited AWS profiles/session tokens. Infrastructure wrappers discard inherited
AWS credentials/config and explicitly configure every used provider endpoint.

Database URLs must reference `kwartrack_api` or a generated
`kwartrack_api_test_*` database on an allowlisted local host and port 7001–7099.
URL query overrides are rejected. Missing database configuration permits liveness
only; readiness returns 503. Startup never applies migrations implicitly.

For fast host development, stop only the API containers while keeping Floci/RDS:

```sh
docker compose -f infra/local/compose.yaml --profile api --profile smoke stop api api-second
pnpm api:dev
```

`api:dev` compiles with TypeScript's decorator metadata enabled and restarts the
compiled server after a successful rebuild. Vitest also imports compiled code,
so dependency injection is exercised with the same metadata as the built app.
The host process is reachable directly; the registered ALB targets are the API
containers. Restore the container path with `pnpm local:api:up` after stopping the
host process. For liveness without any infrastructure, use
`APP_ENV=local DATABASE_URL= pnpm api:dev`.

## Migrations, verification, and lifecycle

```sh
pnpm api:db:generate
pnpm api:db:migrate
pnpm api:db:seed
pnpm api:test
pnpm api:test:integration
pnpm local:test
pnpm local:smoke
pnpm local:smoke:balancing
pnpm local:auth:probe
pnpm local:infra:terraform fmt -check
pnpm local:infra:terraform validate
pnpm local:infra:terraform plan -detailed-exitcode -input=false
pnpm release:check
pnpm run ci
pnpm build
pnpm mcp:build
```

Drizzle SQL and metadata live in `apps/api/drizzle`, outside the production
Supabase migration directory. Phase 1 contains only the
`development.dev_fixture` table and a deterministic synthetic fixture. Seed uses
upsert and preserves other rows. The application uses a single bounded pg pool;
the Drizzle provider and readiness checks share it. Shutdown closes the listener
and pool. Readiness requires the expected migration hash and fixture table, not
merely a successful TCP connection.

Database integration tests create and drop their own unique test database. They
verify migration/seed repeatability, commit/reread, rollback, readiness before and
after migration, bounded pool exhaustion, recovery, and liveness during dependency
failure. An explicitly requested integration run fails when configuration or
dependencies are missing. It never silently skips.

The balancing smoke temporarily starts a second API container, registers it with
the target group, checks traffic reaches both instances, stops/restarts the second
target, and restores the single-target topology afterward.

The [local Cognito guide](local-auth.md) describes the permanent Alice/Bob fixtures
prepared by setup, their credentials, and repeatability/persistence checks.
The auth probe creates and removes a disposable local Cognito pool to verify
the [Phase 2 auth contract](adr/phase-2-auth-contract.md). It checks signatures,
refresh/revocation, negative sign-in cases, local CORS, and signup/recovery
compatibility. It does not install authentication on the API yet.

```sh
pnpm local:stop
pnpm local:setup
# Destructive: deletes this experiment's local database, volumes, and Terraform state.
pnpm local:reset -- --confirm-local-data-loss
pnpm local:setup
```

Stop preserves emulator state and database volumes, including Floci-created
backend containers. Reset requires the confirmation flag and selects only this
project's resources. Keep the Terraform dependency lockfile; state, generated
credentials, and downloaded tools stay ignored.

## Troubleshooting and evidence limits

- Docker connection failure: start Docker Desktop and rerun setup.
- Missing AWS CLI/Terraform: install the required tools or use
  `pnpm local:tools:terraform`; a different Terraform version is rejected.
- Port/subnet conflict: inspect the project status and other local services.
  Do not stop unrelated projects to free a port automatically.
- Readiness 503: verify the discovered database URL, run API migrations, and check
  project logs. Liveness can remain 200 throughout a database outage.
- Changed database URL after a manual infrastructure rebuild: review the API-local
  `DATABASE_URL`. Setup refuses to overwrite a different existing database URL.
- Terraform state lost while emulator resources survive: keep the credential file,
  emulator volume, and database containers intact. Restore the matching ignored
  `terraform.tfstate.backup` before planning. If there is no matching backup, stop
  and inventory resources for Terraform import; an empty state is not evidence of
  an empty emulator. For disposable fixtures, the explicit project reset followed
  by setup is the supported clean-start alternative.
- Emulator state lost while Terraform state survives: inspect the refresh plan
  before applying it. Restoring matching emulator storage preserves resource IDs;
  recreating metadata may leave orphan database containers/volumes. Keep those
  until deciding whether their data must be recovered. If the experiment is
  disposable, use the explicit project reset and setup together so Terraform,
  emulator metadata, generated credentials, and database resources agree again.
- Direct HTTP works but gateway fails: run the routing smoke test and inspect the
  [routing ADR](adr/phase-1-routing.md). Direct success alone is insufficient.

HTTP responses include bounded `X-Request-Id` and `X-Api-Instance` headers.
Request logs contain correlation, method, status, and duration, omitting bodies,
query strings, credentials, and authorization headers. Forwarded headers are not
trusted by default. Swagger is available only in the explicit local application
mode. The API authentication guard and financial features remain in later tickets.

The new API validation workflow runs on matching PRs or manual dispatch with
read-only repository permissions and no deployment credentials. It exercises
real local PostgreSQL and routing. Its first GitHub-hosted run is still required;
local macOS/arm64 evidence does not prove that runner's behavior. The existing
main workflow is unchanged, including its deployment triggers for shared files.
