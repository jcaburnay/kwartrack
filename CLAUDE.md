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
  migrations/           # schema migrations (push via supabase db push)
```

See `specs_v2.md` for the full feature model.

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
