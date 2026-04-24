# Kwartrack (v2)

Personal finance tracker — v2 rebuild on Supabase. Authoritative spec: [`specs_v2.md`](specs_v2.md).

v2 lives on the `v2` branch. `main` still holds v1 (SpacetimeDB + Clerk); it stays untouched until v2 is ready to merge.

## Tech Stack (v2)

| Layer | Tool |
|-------|------|
| Frontend | React 19, TypeScript, Vite |
| Auth / DB / Realtime / Storage | Supabase |
| Styling | Tailwind CSS v4 + DaisyUI v5 |
| Linting/Formatting | Biome (NOT ESLint or Prettier — do not add them) |
| Testing | Vitest + Testing Library |
| Package manager | pnpm |

Slice-specific dependencies (React Router, React Hook Form, Recharts, `@supabase/supabase-js`, lucide-react) get installed as each vertical slice reaches them.

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

## Project Structure (Slice 0)

```
src/
  main.tsx              # entry
  App.tsx               # placeholder shell
  index.css             # tailwind + daisyui imports
  __tests__/            # vitest tests (jsdom)
supabase/
  config.toml           # local CLI config
```

Every later slice adds files under `src/` (providers, hooks, pages, components, utils) and `supabase/migrations/` for schema changes. See `specs_v2.md` for the full feature model and `/Users/binong/.claude/projects/-Users-binong-Projects-kwartrack/memory/project_supabase_migration.md` for the slice roadmap.

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
