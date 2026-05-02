# Kwartrack — Agent Guide

Personal finance tracker on Supabase, deployed at <https://kwartrack.com>. The earlier SpacetimeDB + Clerk implementation is preserved at the `v1-final` tag.

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

## Design Context

### Users
Personal finance tracker built for personal use today, designed to be legible to anyone who encounters it. Users open it during daytime or evening sessions to review balances, log transactions, and check budgets. PH-centric context: PHP currency (₱).

### Brand Personality
**Calm · Trustworthy · Minimal**

Finance carries anxiety — the app should project stability and clarity, never urgency or noise. Every design decision should make the user feel *in control*. Personality expressed through precision and restraint, not decoration.

### Aesthetic Direction
- **Theme**: System-adaptive — light and dark are both first-class. Use DaisyUI semantic tokens throughout (`base-100`, `primary`, `error`, etc.). Starting themes: `silk` (light) + `dim` (dark).
- **Color**: Restrained. Reserve `error`/red for genuinely negative states (over-budget, overdrawn). Avoid color as decoration.
- **Density**: Moderate — denser than a marketing page, not a spreadsheet. Tables use compact rows with comfortable horizontal padding.
- **Shape**: Slightly rounded (`rounded-lg`/`rounded-xl`), consistent with DaisyUI defaults.
- **Motion**: Minimal. Row flash on new items is appropriate; avoid gratuitous transitions.

### Design Principles
1. **Data first, chrome last.** Numbers lead; framing recedes. Hierarchy via size and weight, not decoration.
2. **Calm confidence.** Reserve `error` red for states that genuinely need attention. Avoid ambient urgency.
3. **Legible to a stranger.** Every label and empty state should be self-explanatory to someone who didn't build the app.
4. **Both modes are real.** Never hardcode hex values. Test light and dark when shipping any UI change.
5. **Consistent rhythm.** Prefer DaisyUI component classes over custom utility stacks. Diverge only when the component doesn't exist.
