# Local Cognito foundation — KT-0010 and KT-0011

Verified locally on 2026-11-12. The permanent local Cognito pool and synthetic
users are ready. The Nest API does not yet authenticate requests: strict token
verification, internal user mapping, and the global guard are later tickets.
The existing React application continues to use Supabase.

## Setup and verification

Keep Docker Desktop running, use Node 24 and pnpm 10.34.5, then run:

```sh
pnpm local:setup
pnpm local:auth:test
pnpm local:auth:probe
pnpm local:auth:smoke
pnpm local:auth:restart-smoke
```

Setup provisions Cognito through the guarded Terraform root and prepares fixtures.
`local:auth:setup` repeats only fixture preparation/configuration generation when
infrastructure already exists. The disposable probe verifies the compatibility
matrix and removes only its experiment pool. The fixture smoke repeats setup
twice, checks stable distinct subjects, and verifies signed 900-second access JWTs.

The restart smoke temporarily stops/starts this local stack with volumes retained.
It compares pool/client IDs, user subjects, and existing PostgreSQL development
fixtures before/after restart, then checks sign-in. It finishes with the stack
running and does not reset stored data.

## Synthetic credentials and fixture behavior

| User | Local fixture password |
| --- | --- |
| `alice@kwartrack.local` | `LocalOnly9!Kwartrack` |
| `bob@kwartrack.local` | `LocalOnly9!Kwartrack` |

These are shared synthetic development credentials. Setup uses `AdminCreateUser`
with delivery suppressed, then sets a permanent password outside Terraform.
Passwords are not stored in Terraform state or passed on command lines. Temporary
CLI input files have mode 600 and are removed after each operation.

Administration checks the Terraform-selected pool's ID/name/project tag and the
associated public client's ID/name/ownership/flows/absence of a secret. Existing
confirmed users keep their subjects, passwords, and enabled/disabled state.
Interrupted initial creation in `FORCE_CHANGE_PASSWORD` state can finish without
recreating the user. Deliberately changing a fixture password or disabling it can
make smoke fail; routine setup preserves that state.

## Infrastructure and configuration

The user pool is the user directory; an app client defines how a particular
application authenticates against it. Terraform owns `kwartrack-api-local` and
`kwartrack-api-local-public`. The secretless
public client enables password sign-in, non-rotating refresh, refresh revocation,
15-minute access/ID tokens, and a one-day refresh lifetime. Passwords and user
creation remain separate from resource provisioning. The provider explicitly
overrides `cognitoidp` to Floci; the endpoint guard rejects an incomplete map.

Generated `infra/local/auth.env.local` is ignored and mode 600. It contains public
pool/client IDs, the canonical issuer, and separate host/container operation/JWKS
URLs, with no password, token, database URL, or IAM credential.

The issuer is exactly `http://floci:4566/<pool-id>`. Host processes fetch keys at
`http://127.0.0.1:4566/<pool-id>/.well-known/jwks.json`; containers use `floci`.
Trusted configuration selects those addresses; incoming claims never select a
key-fetch URL. Auth-lab origins are `http://127.0.0.1:5174` and
`http://localhost:5174`.

## Controlled fixture reset

```sh
pnpm local:auth:reset -- --confirm-local-auth-data-loss
```

This separate destructive operation deletes/recreates only Alice/Bob in the
checked local pool. The flag is required before any infrastructure tool runs.
It preserves the pool/client, other users, and application database rows. New
subjects mean new application identities; old ownership mappings must never be
relinked by matching email. Pool recreation/full backend reset also changes
identity assumptions and requires explicit handling.

The missing-confirmation path was tested. Actual destructive reset was not run;
it requires explicit authorization when needed.

## Evidence and handoff

Verified locally: the full compatibility probe, two fixture guard tests, nine
infrastructure tests, 22 API tests, additive Terraform apply, repeated setup/login,
and restart identity/database persistence. The final Terraform plan reported no
changes. Formatting, build, release alignment,
and the restored direct/ALB/gateway health paths passed. An independent review
found no blocking issue in these two tickets.

GitHub-hosted CI still needs its first run. Actual browser interaction, correct
emailed confirmation/recovery codes, and hosted AWS behavior are not established.
See the [auth contract and compatibility ADR](adr/phase-2-auth-contract.md).

Next: KT-0012 adds strict access-token verification; KT-0013 adds internal user
mapping/basic profile initialization; KT-0014 installs the global guard.
