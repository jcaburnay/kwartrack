# Phase 1 — local RDS and private HTTP routing

Date: 2026-11-10. Status: verified locally on Apple Silicon; hosted AWS and Linux CI are not certified by this experiment.

## Decision

Keep the planned path: client → API Gateway HTTP API → VPC Link → ALB listener → NestJS/Express. Use Floci's real PostgreSQL RDS backend. Do not substitute a direct gateway-to-API proxy or an unrelated PostgreSQL Compose service.

`infra/local/compose.yaml` owns the isolated Docker network, Floci storage, and optional API containers. `infra/terraform/local/main.tf` owns the emulated VPC, two subnets, security group, RDS instance/subnet group, ALB/target group/listener, HTTP API, VPC Link, integration, route, and default stage. Application migrations remain under `apps/api/drizzle`.

## Tested versions

| Component | Tested value |
| --- | --- |
| Host | macOS Darwin 25.6.0 / arm64 |
| Docker Desktop engine | 29.9.2 / aarch64 |
| Floci | 2.4.0, native arm64, pinned multi-platform digest in Compose |
| PostgreSQL | 16.6-alpine, native arm64, pinned default image digest in Compose |
| Terraform | 1.13.4 / darwin_arm64 |
| Terraform AWS provider | 6.20.0; dependency lockfile included |
| AWS CLI | 2.39.6 |
| API runtime/package manager | Node 24.22.1 / pnpm 10.34.5 |

The optional `scripts/local/infra/install-terraform.mjs` installer downloads Terraform to ignored `infra/local/.tools`, checks the archive against HashiCorp's published SHA256 checksums, and leaves global tool installations untouched. It supports macOS/Linux arm64/amd64; only the macOS arm64 path was exercised here.

## Endpoints and address ownership

| Purpose | Host | Docker network |
| --- | --- | --- |
| AWS management | `http://127.0.0.1:4566` | `http://floci:4566` |
| RDS data proxy | discovered `127.0.0.1:7001` | discovered `floci:7001` |
| API | `http://127.0.0.1:3000` | `172.29.240.10:3000` |
| Optional second API | `http://127.0.0.1:3001` | `172.29.240.11:3000` |
| ALB HTTP listener | `http://127.0.0.1:8080` | Floci port 8080 |

Compose reserves `172.29.240.0/24` for the named `kwartrack-backend-local` bridge. API target IPs are assigned by Compose rather than copied from ephemeral inspection output. If this subnet conflicts with another local network, change Compose and Terraform target addresses together before provisioning. Emulated VPC subnets are separate logical resources; they do not create this Docker network.

All published host ports bind loopback. The RDS backend container exposes 5432 only within Docker; clients use Floci's discovered proxy port. The reserved proxy range is 7001–7004. Resource-specific host/container URLs are written to mode-600 ignored `infra/local/backend.env.local`; passwords are generated in an ignored mode-600 Terraform variable file. Neither file should be copied into evidence or committed.

Use the gateway path `http://127.0.0.1:4566/execute-api/<api-id>/$default/health/live`. The `$default` stage reaches Nest as `/health/live`, without a stage prefix. ALB calls use its Terraform-generated DNS name in `Host` when ambiguity between load balancers would otherwise matter.

## Observed verification

- Terraform init, validate, apply, and repeated no-change plans succeeded. A post-restart plan also reported no changes.
- Real SQL was migrated/seeded through the discovered RDS endpoint. RDS's `available` metadata alone was not treated as SQL readiness.
- Direct API, ALB, and private gateway calls returned 200 for `/health/live` and `/health/ready`; backend missing-route 404 responses were preserved.
- A controlled request ID and the API instance header survived every hop. Missing-route responses confirmed that path and repeated query values reached Nest. Gateway encoding changed a space from `%20` to `+`; decoded values were identical.
- With two registered targets, 20 gateway requests reached both API instances. Stopping the second target made it unhealthy; 12 subsequent gateway calls reached only the first. Restarting the second restored two healthy targets and traffic to both. The script returned to the normal single-target topology afterward.
- A synthetic SQL probe survived the documented stop/setup sequence. Floci restored its PostgreSQL backend from the retained named volume automatically. Routing and readiness recovered afterward; the temporary probe was removed.
- Guard tests reject missing local mode, hosted endpoint overrides, incomplete provider endpoint maps, extra AWS providers, and reset without its explicit data-loss flag. Child-command environments discard inherited AWS profiles, session tokens, web-identity settings, and service endpoint overrides.
- HTTP readiness tests exercise real 503→200 startup, bounded persistent failure, and immediate failure for an unsupported route. Smoke tests wait up to 30 seconds for each actual proxy health route rather than treating direct-port readiness as proxy readiness.

## Compatibility findings

Terraform's AWS provider has separate `apigateway` and `apigatewayv2` endpoint settings. The initial compatibility attempt configured only the former; the v2 call reached AWS and was rejected with the hardcoded dummy credential. No real AWS credential was supplied. The configuration now sets every used endpoint explicitly, and the wrapper refuses incomplete endpoint maps before invoking Terraform. Reproducing this failure is unnecessary; the guard test removes the v2 entry from a controlled configuration and checks rejection without networking.

Interrupted creation can leave Terraform resources tainted even after Floci has created them. During this experiment an interrupted RDS create was recovered by verifying the actual instance, then untainting its matching local state and refreshing it. Do not blindly rerun a replacement plan against a database whose contents need preserving. See the local-backend runbook for emulator-state-loss versus Terraform-state-loss recovery.

## Lifecycle and limits

`lifecycle.mjs stop` stops Compose services and any remaining project-labeled spawned backend containers, preserving all storage. `setup.mjs` restarts Floci and reconciles its managed resources. `lifecycle.mjs reset --confirm-local-data-loss` prints the selected project resources, removes only this experiment's containers/volumes and generated state, and preserves the Terraform provider lockfile. It removes the API's generated `DATABASE_URL` only when it still matches the old generated value; independently configured values remain untouched and require reconciliation.

Mounting the Docker socket gives Floci control of the local daemon. Project labels scope this tooling's cleanup, but they are not a security sandbox for the daemon. Floci's emulated VPC/security-group configuration does not reproduce real AWS packet isolation. Health, balancing, and recovery were observed only for this pinned local setup. This is neither a production networking design nor a production availability certification.

## Primary references

- [Floci HTTP API private integrations](https://floci.io/floci/services/api-gateway/#http-api-private-integrations)
- [Floci ELB v2](https://floci.io/floci/services/elb/)
- [Floci RDS configuration and persistence](https://floci.io/floci/services/rds/)
- [Floci Docker configuration](https://floci.io/floci/configuration/docker/)
- [Terraform downloads](https://releases.hashicorp.com/terraform/1.13.4/)

References were checked during implementation. Runtime observations above are from the local checks, not inferred solely from documentation.
