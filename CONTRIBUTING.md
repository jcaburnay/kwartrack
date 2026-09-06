# Contributing to Kwartrack

Thanks for helping improve Kwartrack. Changes should preserve its calm,
trustworthy, and minimal approach to personal finance.

## Before you start

- Read [`specs_v2.md`](specs_v2.md); it is the authoritative product and data-model spec.
- Read [`AGENTS.md`](AGENTS.md) for TypeScript, UI, database, and commit conventions.
- Search existing issues before opening a new one.
- For security problems, follow [`SECURITY.md`](SECURITY.md) instead of filing a public issue.

## Development setup

Install Node 24.x, Corepack, and Docker, then run:

```bash
git clone https://github.com/jcaburnay/kwartrack.git
cd kwartrack
corepack enable
pnpm bootstrap
pnpm dev
```

The setup command creates a gitignored `.env.local` and a local Supabase database
containing synthetic demo data. It never connects to production. See the README
for demo credentials and reset instructions.

## Making a change

1. Create a focused branch from `main`.
2. Keep migrations additive; pushes to `main` can deploy them automatically.
3. Use strict TypeScript without `any` or `@ts-ignore`.
4. Use DaisyUI semantic tokens and verify both `corporate` light mode and
   `business` dark mode for UI changes.
5. Add or update tests for changed behavior.
6. Run the required checks:

   ```bash
   pnpm run ci
   pnpm test
   pnpm build
   pnpm mcp:test
   pnpm mcp:build
   pnpm mcp:worker:build
   ```

Database integration tests run when the local stack is active and
`SUPABASE_SECRET_KEY` is present in `.env.local`; `pnpm bootstrap` configures both.

## Pull requests

- Use a Conventional Commit-style title, such as `fix(accounts): preserve balance on edit`.
- Explain the user-visible outcome and notable implementation choices.
- Include screenshots for visual changes in both light and dark modes.
- Call out migrations, new environment variables, or deployment changes.
- Keep unrelated refactors out of the pull request.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
