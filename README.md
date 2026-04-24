# Kwartrack

Personal finance tracker (PHP, single-user). Manage accounts, transactions, recurring charges, budgets, and debt splits.

This branch (`v2`) is a ground-up rebuild on a new stack. The authoritative design lives in [`specs_v2.md`](specs_v2.md). `main` still carries v1 (SpacetimeDB + Clerk) and is frozen until v2 merges.

## Stack

React 19 + TypeScript + Vite · Supabase (Auth + DB + Realtime + Storage) · Tailwind v4 + DaisyUI v5 · Biome · Vitest · pnpm.

## Setup

```bash
git clone <repo-url>
cd kwartrack
pnpm install
cp .env.example .env.local
```

## Local Supabase

Requires Docker Desktop running.

```bash
pnpm supabase:start     # boot local Postgres + Auth + Studio
pnpm supabase:status    # print live service URLs & keys
pnpm supabase:stop      # tear it all down
```

Paste the live `API URL` and `anon key` from `supabase:status` into `.env.local`.

## Dev commands

| Command | Description |
|---------|-------------|
| `pnpm dev`       | Vite dev server |
| `pnpm test`      | Vitest run |
| `pnpm test:watch`| Vitest watch mode |
| `pnpm check`     | Biome format + lint (auto-fix) |
| `pnpm run ci`    | Biome CI check (no autofix) — `run` is required; `pnpm ci` is reserved |
| `pnpm build`     | `tsc -b && vite build` |

## Where to look

- **[`specs_v2.md`](specs_v2.md)** — full v2 feature spec and data model.
- **[`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md)** — conventions for AI coding agents working in the repo.
