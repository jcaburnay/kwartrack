# Kwartrack

Personal finance tracker on Supabase, deployed at <https://kwartrack.com>. Authoritative spec: [`specs_v2.md`](specs_v2.md). The earlier SpacetimeDB + Clerk implementation is preserved at the `v1-final` tag.

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | React 19, TypeScript, Vite |
| Auth / DB / Realtime / Storage | Supabase |
| Styling | Tailwind CSS v4 + DaisyUI v5 |
| Linting/Formatting | Biome (NOT ESLint or Prettier — do not add them) |
| Testing | Vitest + Testing Library |
| Package manager | pnpm |

Other runtime dependencies: React Router, React Hook Form, Recharts, `@supabase/supabase-js`, lucide-react.

## Commands

```bash
pnpm dev                # start dev server
pnpm test               # run tests (vitest run)
pnpm test:watch         # watch mode
pnpm check              # biome format + lint (auto-fix)
pnpm run ci             # biome ci (no autofix) — must use `run` because `pnpm ci` is reserved
pnpm build              # tsc -b && vite build
pnpm supabase:start     # boot local Supabase stack (requires Docker)
pnpm supabase:status    # list local service URLs
pnpm supabase:stop      # tear down local stack
```

## Project Structure

```
src/
  main.tsx              # entry
  App.tsx               # app shell + router
  index.css             # tailwind + daisyui imports
  components/           # UI grouped by feature
  hooks/                # data hooks
  lib/supabase.ts       # supabase client
  pages/                # route components
  providers/            # AuthProvider etc.
  types/                # generated supabase types
  utils/                # helpers
  __tests__/            # vitest (jsdom)
supabase/
  config.toml           # local CLI config
  migrations/           # schema migrations (auto-applied by CI on push to main)
```

See `specs_v2.md` for the full feature model.

## Local development

The dev workflow runs against a **self-hosted Supabase stack**, not the cloud project. `.env.local` is gitignored and must point at `http://127.0.0.1:54321` — never paste production URLs there.

```
1. pnpm supabase:start      # Docker stack up: Postgres@54322, Auth/API@54321, Studio@54323
2. pnpm dev                 # Vite reads .env.local, app talks to local
   ...                      # write code, test
3. pnpm supabase:stop       # tear down at end of session
```

When you change the schema:

```
1. supabase migration new <name>     # creates supabase/migrations/<ts>_<name>.sql
2. (write the SQL)
3. pnpm exec supabase db reset       # re-applies all migrations to local DB
4. pnpm types:gen                    # regen src/types/supabase.ts from local
5. (verify; commit)
```

Integration tests under `src/__tests__/*.integration.test.ts` use the **local** service-role key (`SUPABASE_SECRET_KEY` in `.env.local`, copied from `pnpm supabase:status`) to seed/clean test data. They auto-skip when the key isn't present, so the unit suite still runs without it.

## Deployment

`main` auto-deploys via `.github/workflows/ci.yml`. A push runs **lint → test → build**, then (if any `supabase/migrations/*.sql` changed) **`supabase db push`**, then ships the bundle to Cloudflare Pages at <https://kwartrack.com>. Any failing step blocks the deploy.

Implications when writing changes:
- **Migrations land in prod automatically.** Keep them additive: new tables, new columns, new policies. Avoid renames, type changes, and drops. When unavoidable, do a multi-step add-then-remove rollout coordinated with the app code.
- **App env vars are baked at CI build time** from repo secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Adding a new `VITE_*` requires a matching repo secret and a `validate` job env-var line.
- **Manual fallback for migrations** is `pnpm exec supabase db push` (CI does this on every push when migrations change).

## TypeScript

`strict: true` in `tsconfig.app.json`. Additionally:
- No explicit `any` — use `unknown` + narrowing.
- No `@ts-ignore` — fix the underlying type issue.
- Prefer inference over verbose annotations where obvious.

## Commit Messages

Conventional Commits: `type(scope): description`.

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`.

Likely scopes (from the spec): `ui`, `auth`, `accounts`, `transactions`, `tags`, `recurring`, `budget`, `debts`, `splits`, `settings`, `overview`, `db`, `ci`.

Examples:
```
feat(budget): add per-tag allocation table
fix(accounts): clamp monthly recurring day-of-month to last day
refactor(transactions): extract balance-delta helper
```

## Tailwind / DaisyUI

- Tailwind v4: config lives in `vite.config.ts` via `@tailwindcss/vite` and `src/index.css` via `@plugin "daisyui"`. There is no `tailwind.config.js`.
- Prefer DaisyUI component classes (`btn`, `modal`, `card`, `badge`, etc.) before writing custom utility stacks.

## Assets

- `public/` — referenced by URL (favicons, `_headers`, `_redirects`).
- `src/assets/` — imported directly in components.
