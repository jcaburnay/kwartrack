# Kwartrack (v2) — Agent Guide

Personal finance tracker being rebuilt as v2 on Supabase. `main` still carries v1 (SpacetimeDB + Clerk); all v2 work happens on the `v2` branch.

For any task, start here:

1. **Spec:** [`specs_v2.md`](specs_v2.md) is the authoritative source for features, data model, and UX.
2. **Project conventions:** [`CLAUDE.md`](CLAUDE.md) covers stack, commands, TypeScript rules, commit-message format, Tailwind/DaisyUI guidance.

Commands:

```bash
pnpm dev                # vite dev server
pnpm test               # vitest run
pnpm check              # biome check --write .
pnpm run ci             # biome ci . (no autofix) — must use `run`, `pnpm ci` is reserved
pnpm build              # tsc -b && vite build
pnpm supabase:start     # local Supabase stack (Docker required)
pnpm supabase:status    # list local service URLs
pnpm supabase:stop      # tear down local stack
```

Commit format: Conventional Commits (`type(scope): description`). Full list of scopes is in `CLAUDE.md`.
