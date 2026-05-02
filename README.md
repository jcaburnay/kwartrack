# Kwartrack

A personal finance tracker, built single-user, ₱-first. Live at <https://kwartrack.com>.

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

The full feature model and data design lives in [`specs_v2.md`](specs_v2.md).

## Stack

React 19 + TypeScript + Vite · Supabase (Auth + Postgres + Realtime + Storage) · Tailwind v4 + DaisyUI v5 · Biome · Vitest · pnpm.

## Local development

Requires Node 24+, pnpm 10+, Docker Desktop (for local Supabase).

```bash
git clone git@github.com:jcaburnay/kwartrack.git
cd kwartrack
pnpm install
cp .env.example .env.local

pnpm supabase:start     # boot local Postgres + Auth + Studio (http://127.0.0.1:54323)
pnpm supabase:status    # print live service URLs & keys
```

Paste the `API URL` and publishable key from `supabase:status` into `.env.local`, then:

```bash
pnpm dev                # Vite dev server at http://localhost:5173
```

### Commands

| Command            | Description                                                |
|--------------------|------------------------------------------------------------|
| `pnpm dev`         | Vite dev server                                            |
| `pnpm test`        | Vitest run                                                 |
| `pnpm test:watch`  | Vitest watch mode                                          |
| `pnpm check`       | Biome format + lint (auto-fix)                             |
| `pnpm run ci`      | Biome CI check (no autofix) — `pnpm ci` is reserved        |
| `pnpm build`       | `tsc -b && vite build`                                     |
| `pnpm types:gen`   | Regenerate `src/types/supabase.ts` from local schema       |

## Deployment

Production deploys to Cloudflare Pages on every push to `main`, gated by CI:

```
git push main  →  GitHub Actions (.github/workflows/ci.yml)
                  ├─ pnpm run ci      (Biome lint + format check)
                  ├─ pnpm test        (Vitest)
                  ├─ pnpm build       (tsc + Vite, env vars baked in)
                  └─ wrangler pages deploy dist
                                      ↓
                  Cloudflare Pages → https://kwartrack.com
```

Cloudflare Pages' own auto-build is intentionally paused — CI is the single source of truth for production deploys, so a failing test or lint blocks the deploy.

### Required secrets

| Where             | Name                              | Purpose                          |
|-------------------|-----------------------------------|----------------------------------|
| GitHub Actions    | `CLOUDFLARE_API_TOKEN`            | wrangler authentication          |
| GitHub Actions    | `CLOUDFLARE_ACCOUNT_ID`           | wrangler target account          |
| GitHub Actions    | `VITE_SUPABASE_URL`               | bundled into the production JS   |
| GitHub Actions    | `VITE_SUPABASE_PUBLISHABLE_KEY`   | bundled into the production JS   |

### Database migrations

Schema migrations live in `supabase/migrations/` and are applied to the linked remote project with:

```bash
pnpm exec supabase db push
```

Run this manually after merging schema changes to `main` (no automation yet).

## Repository pointers

- [`specs_v2.md`](specs_v2.md) — authoritative feature spec and data model
- [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md) — conventions for AI coding agents working in the repo
- `v1-final` git tag — the previous SpacetimeDB + Clerk implementation, preserved for archaeology
