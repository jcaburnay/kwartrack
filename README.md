# Kwartrack

[![CI](https://github.com/jcaburnay/kwartrack/actions/workflows/ci.yml/badge.svg)](https://github.com/jcaburnay/kwartrack/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-kwartrack.com-22c55e)](https://kwartrack.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A personal finance tracker, built single-user, ₱-first.

Manage everyday money flow without the overhead of a full bookkeeping app: log transactions across all your accounts, set monthly budget caps and per-tag allocations, automate recurring charges (Netflix, Spotify, salary), track debts and group splits, and watch your time-deposits accrue interest until maturity.

## Features

- **Accounts** — group e-wallets, bank accounts, cash, credit cards, and time deposits, optionally nested under account groups (Maya wallet + Maya savings, GCash, BPI, etc.)
- **Transactions** — expense, income, and inter-account transfers with optional fees, tags, descriptions, and dates
- **Recurring** — schedule monthly/weekly/quarterly expenses or income with installment counters; transactions auto-post on schedule
- **Budgets** — per-month overall cap plus per-tag allocations (foods ₱X, bills ₱Y, …) with over-budget warnings
- **Debts & splits** — track loans owed/loaned with running settlement balance; create split events with friends (equal, exact, percentage, shares) that auto-generate the right debt rows
- **Time deposits** — set principal + interest rate + maturity; interest posts automatically on the chosen cadence (monthly/quarterly/at-maturity)
- **Real-time sync** — multiple tabs/devices stay in sync via Supabase Realtime
- **Light/dark themes** — system-adaptive

The full feature model and data design lives in [`specs.md`](specs.md).

## Self-hosting

Kwartrack is a static SPA plus a Supabase backend, so you can run your own
instance on free tiers.

**Prerequisites:** Node 24.x, Corepack, and a free [Supabase](https://supabase.com)
project. The repository pins pnpm 10.34.5 through `package.json`.

1. **Clone and install:**
   ```bash
   git clone https://github.com/jcaburnay/kwartrack.git
   cd kwartrack
   corepack enable
   pnpm install --frozen-lockfile
   ```
2. **Create a Supabase project** and copy its API URL and publishable key.
3. **Apply the schema** — link the CLI to your project and push migrations:
   ```bash
   pnpm exec supabase link --project-ref <your-project-ref>
   pnpm exec supabase db push
   ```
4. **Configure Auth URLs** in Supabase Dashboard → Authentication → URL
   Configuration. Set **Site URL** to your deployed origin (for example,
   `https://finance.example.com`) and add `https://finance.example.com/**` to
   **Redirect URLs**. Add `http://localhost:5173/**` too if you will run the web
   app locally. Email confirmation and OAuth redirects will fail if these origins
   are omitted.
5. **Configure env** — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
   to your project's values (see `.env.example`). Google authentication is hidden
   by default; set `VITE_GOOGLE_AUTH_ENABLED=true` only after enabling and
   configuring Google in Supabase Dashboard → Authentication → Providers.
6. **Build the web app:**
   ```bash
   pnpm build
   ```
7. **Deploy** `apps/web/dist/` to any static host (Cloudflare Pages, Vercel,
   Netlify, or your own). Ensure SPA routing rewrites all paths to
   `index.html` (see `apps/web/public/_redirects`).

The MCP server (`apps/mcp`) is optional and only needed for the ChatGPT/MCP
integration; see `apps/mcp/README.md`.

## Repository layout

```text
apps/web/     React/Vite application deployed to kwartrack.com
apps/mcp/     MCP Worker deployed to mcp.kwartrack.com
supabase/     Shared database configuration and migrations
scripts/      Repository-level automation
```

## Stack

React 19 + TypeScript + Vite · Supabase (Auth + Postgres + Realtime + Storage) · Tailwind v4 + DaisyUI v5 · Biome · Vitest · pnpm.

## Local development

Requires Node 24.x, Corepack, and Docker Desktop (or another Docker-compatible
daemon). Node 25 and newer are not currently supported.

```bash
git clone https://github.com/jcaburnay/kwartrack.git
cd kwartrack
corepack enable
pnpm bootstrap
pnpm dev
```

`pnpm bootstrap` installs the locked dependencies, starts the local Supabase stack,
and writes its generated local credentials to the gitignored `.env.local` file.
The first start also loads synthetic demo data. Sign in with:

- Email: `demo@kwartrack.local`
- Password: `demo-password`

The app runs at <http://localhost:5173> and Supabase Studio at
<http://127.0.0.1:54323>. Create a separate account if you prefer to start empty.

Local Supabase services use well-known development keys and may be reachable on
your local network. Do not expose their ports to the public internet or reuse
their credentials in production.

### Resetting local data

```bash
pnpm supabase:reset
```

This deletes the local database, reapplies every migration, and reloads only the
synthetic demo data in `supabase/seed.sql`. It never reads from a hosted project.

If another clone left stale `supabase_*_kwartrack` containers behind, first
confirm that you do not need their local data, then run
`pnpm supabase:stop --no-backup` before retrying setup. The command permanently
removes that local stack's database.

Google OAuth is disabled in the checked-in local configuration so setup needs no
provider secrets. Email/password authentication works out of the box. Production
OAuth is configured independently in the Supabase dashboard.

### Commands

| Command            | Description                                                |
|--------------------|------------------------------------------------------------|
| `pnpm bootstrap`   | Install dependencies, start Supabase, and generate local env |
| `pnpm dev`         | Vite dev server                                            |
| `pnpm test`        | Vitest run                                                 |
| `pnpm test:watch`  | Vitest watch mode                                          |
| `pnpm check`       | Biome format + lint (auto-fix)                             |
| `pnpm run ci`      | Biome CI check (no autofix) — `pnpm ci` is reserved        |
| `pnpm build`       | `tsc -b && vite build`                                     |
| `pnpm supabase:reset` | Rebuild the local database with synthetic demo data     |
| `pnpm types:gen`   | Regenerate `apps/web/src/types/supabase.ts`                |

## Deployment

Production deploys to Cloudflare on every push to `main`, gated by CI:

```
git push main  →  GitHub Actions (.github/workflows/ci.yml)
                  ├─ validate
                  │   ├─ pnpm run ci      (Biome lint + format check)
                  │   ├─ pnpm test        (Vitest)
                  │   └─ pnpm build       (tsc + Vite, env vars baked in)
                  │
                  ├─ deploy_db            (only when supabase/migrations/** changed)
                  │   └─ supabase db push
                  │
                  ├─ deploy
                  │   └─ wrangler pages deploy dist
                  │                       ↓
                  │   Cloudflare Pages → https://kwartrack.com
                  │
                  └─ deploy_mcp           (only when MCP/workspace files changed)
                      └─ wrangler deploy
                                          ↓
                      Cloudflare Worker → https://mcp.kwartrack.com/mcp
```

Cloudflare's own repository builds are intentionally paused — GitHub Actions is the single source of truth for production deploys, so a failing test or lint blocks both deployments.

### Releases

Kwartrack uses [Semantic Versioning](https://semver.org/) starting at `1.0.0`.
The workspace, web app, and MCP package advance together under tags such as
`v1.0.0`; release notes are published through
[GitHub Releases](https://github.com/jcaburnay/kwartrack/releases). After a
version change reaches `main`, CI publishes the release automatically once the
production deployment succeeds. Subsequent commits at the same version do not
create duplicate releases. The historical `v1-final` tag is an archive of the
retired SpacetimeDB and Clerk implementation, not part of the current release
sequence.

### Required secrets

| Where             | Name                              | Purpose                                          |
|-------------------|-----------------------------------|--------------------------------------------------|
| GitHub Actions    | `CLOUDFLARE_API_TOKEN`            | Cloudflare Pages and MCP Worker deployments       |
| GitHub Actions    | `CLOUDFLARE_ACCOUNT_ID`           | wrangler target account                          |
| GitHub Actions    | `VITE_SUPABASE_URL`               | bundled into the production JS                   |
| GitHub Actions    | `VITE_SUPABASE_PUBLISHABLE_KEY`   | bundled into the production JS                   |
| GitHub Actions    | `SUPABASE_ACCESS_TOKEN`           | auth for `supabase link` in the deploy_db job    |
| GitHub Actions    | `SUPABASE_DB_PASSWORD`            | DB password for `supabase db push`               |
| GitHub Actions    | `SUPABASE_PROJECT_ID`             | target Supabase project ref to link against      |

### Database migrations

Schema migrations live in `supabase/migrations/`. CI's `deploy_db` job auto-applies them to the linked Supabase project on every push to `main` whenever any file under `supabase/migrations/**` changes — `supabase db push` is not run manually in the normal flow.

Manual fallback (for hot-fixes or recovery):

```bash
pnpm exec supabase db push
```

Because migrations land in production automatically, **keep them additive** — new tables, new columns, new policies. Avoid renames, type changes, and drops; when unavoidable, do a multi-step add-then-remove rollout coordinated with the app code.

## Repository pointers

- [`specs.md`](specs.md) — authoritative feature spec and data model
- [`AGENTS.md`](AGENTS.md) — canonical conventions for AI coding agents
- [`CLAUDE.md`](CLAUDE.md) — Claude Code compatibility import of `AGENTS.md`
- [`.impeccable.md`](.impeccable.md) — canonical design context
- [GitHub Releases](https://github.com/jcaburnay/kwartrack/releases) — current release history and notes
- `v1-final` git tag — archived SpacetimeDB + Clerk implementation

## Contributing and security

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
development workflow and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community
expectations. Please report vulnerabilities privately as described in
[`SECURITY.md`](SECURITY.md), not in a public issue.

Kwartrack is released under the [MIT License](LICENSE).
