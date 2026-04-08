# Kwartrack

Personal finance tracker. Users manage accounts, partitions (sub-buckets), transactions, recurring transactions, budgets, and debt splits.

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | React 19, TypeScript, Vite |
| Routing | React Router v7 |
| Auth | Clerk (`@clerk/react`) |
| Backend/DB | SpacetimeDB 2.x — see `server/CLAUDE.md` for all backend rules |
| Styling | Tailwind CSS v4 + DaisyUI v5 |
| Linting/Formatting | Biome (NOT ESLint or Prettier — do not add them) |
| Testing | Vitest + Testing Library |

## Commands

```bash
pnpm dev                # start dev server
pnpm test               # run tests
pnpm check              # biome format + lint (auto-fix)
pnpm generate           # regenerate src/module_bindings/ after schema changes
pnpm server:publish     # publish SpacetimeDB module to maincloud
```

## Project Structure

```
src/
  main.tsx              # entry — provider tree
  App.tsx               # routes
  providers/            # ClerkTokenProvider, SpacetimeDBProvider
  pages/                # one file per route
  components/           # shared UI
  utils/                # pure computation (budgetCompute, currency, etc.)
  module_bindings/      # AUTO-GENERATED — never edit, run pnpm generate
  __tests__/            # Vitest tests
server/
  spacetimedb/src/
    schema.ts           # table definitions
    index.ts            # reducers + lifecycle hooks
```

## Auth & Identity — Critical Gotchas

Provider nesting is mandatory — do not reorder:
```
ClerkProvider → ClerkTokenProvider → SpacetimeDBProvider → App
```

**Clerk JWT ≠ SpacetimeDB token.** SpacetimeDB uses its own token (persisted in `localStorage` as `spacetimedb_token`). Using the Clerk JWT as a SpacetimeDB token creates a new anonymous identity on every session, breaking all per-user data.

**Do not build a custom ProtectedRoute.** Use Clerk's `<Show when="signed-in">` component directly (see `App.tsx`).

On connect, `linkClerkIdentity` reducer links the Clerk user ID to the SpacetimeDB identity so the same user sees the same data across devices.

## SpacetimeDB Client — Key Rules

- `useTable(tables.myAccounts)` returns `[rows, isLoading]` — always destructure as a tuple
- Reducer calls use object syntax: `conn.reducers.createAccount({ name: 'Savings' })` — never positional
- Never optimistically update UI state — let subscriptions drive all data
- Subscriptions are set up once in `SpacetimeDBProvider` — do not add subscriptions elsewhere
- All data views are prefixed `my_` and are per-user (filtered by `ctx.sender` server-side)
- Timestamps: `new Date(Number(row.createdAt.microsSinceUnixEpoch / 1000n))` — not `new Date(row.createdAt)`

## TypeScript

`strict: true` is on (`tsconfig.app.json`) — the compiler enforces it. Additionally:
- No explicit `any` — use `unknown` + type narrowing instead
- No `@ts-ignore` — fix the underlying type issue
- Prefer type inference over verbose explicit annotations where the type is obvious

## Commit Messages

Conventional Commits format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`

Common scopes from this project: `ui`, `budget`, `accounts`, `transactions`, `tags`, `partition`, `recurring`, `debts`, `settings`, `charts`, `auth`

Examples:
```
feat(budget): add monthly rollover toggle
fix(tags): handle empty tag list in modal
refactor(accounts): extract balance calculation to util
```

## Assets

- `public/` — for assets referenced by URL (favicons, manifests, etc.)
- `src/assets/` — for assets imported directly in components

## Tailwind / DaisyUI

- Tailwind v4: config is in `vite.config.ts` via `@tailwindcss/vite` — there is no `tailwind.config.js`
- Prefer DaisyUI component classes (`btn`, `modal`, `card`, `badge`, etc.) before writing custom Tailwind utilities
