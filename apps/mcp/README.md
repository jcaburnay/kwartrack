# Kwartrack MCP server

ChatGPT integration for Kwartrack. It exposes five read tools and one narrowly scoped write tool
over Streamable HTTP:

- `get_financial_summary`
- `list_accounts`
- `search_transactions`
- `create_transaction` — records a user-confirmed receipt as an expense
- `get_budget_status`
- `list_upcoming`

## Web app feature coverage

This table compares the major web app features defined in [`specs_v2.md`](../../specs_v2.md) with
the tools currently registered by the MCP server. **Partial** means ChatGPT can access only the
listed subset of the web feature; it does not imply full CRUD support.

| Web app feature | Web app capabilities | Current MCP action | Coverage and limitations |
| --- | --- | --- | --- |
| Overview | Current assets, liabilities, net worth, monthly cash flow, budget progress, spend trend, and upcoming items | `get_financial_summary`, `get_budget_status`, `list_upcoming` | **Partial.** Returns the headline values, detailed budget status, upcoming recurrings, and unsettled debts. It does not reproduce charts, the 12-month trend, or UI drill-downs. |
| Accounts | List, create, edit, archive, delete, group, and inspect account-type details | `list_accounts`, `get_financial_summary` | **Partial, read-only.** Lists current balances and selected type-specific fields, with optional type and archived-account filters. It cannot create, edit, archive, delete, or regroup accounts. |
| Transactions | Search and filter expenses, income, and transfers; create, edit, and delete transactions | `search_transactions`, `create_transaction` | **Partial.** Search supports date, type, account, tag, text, and sort filters. The only write action records one user-confirmed receipt as an idempotent expense. It cannot create income or transfers, or edit or delete any transaction. |
| Recurring transactions | List, filter, create, edit, pause, resume, and automatically fire recurring entries | `list_upcoming` | **Partial, read-only.** Returns active recurrings due within a requested future window. It cannot list all recurring definitions or create, edit, pause, resume, or fire them. |
| Budget | View monthly overall and per-tag progress; set the overall cap and tag allocations | `get_budget_status`, `get_financial_summary` | **Partial, read-only.** Returns overall and per-tag budget versus actual spending, remaining amounts, over-budget flags, and unbudgeted spending. It cannot change caps or allocations. |
| Debts | List, filter, create, edit, delete, and settle owed or loaned debts | `list_upcoming` | **Partial, read-only.** Returns currently unsettled debts alongside upcoming recurrings. It cannot show the complete debt-management view or create, edit, delete, or settle debts. |
| Splits | List and inspect split details; create, edit, delete, and settle participant shares | None | **Not available.** |
| Tags | List and manage expense, income, transfer, and system tags | None | **Not available as a standalone action.** `search_transactions` can filter by an exact tag name, and `create_transaction` requires an existing non-system expense tag. |
| Contacts | List and manage people used by debts and splits | None | **Not available.** |
| Account groups | List and manage account groups and memberships | `list_accounts` | **Partial, read-only.** Account results include the group name, but groups and memberships cannot be managed. |
| Profile and appearance | Edit profile, timezone, password, and theme | None | **Not available.** The MCP server reads the profile timezone internally for date calculations but does not expose profile-management actions. |
| Data export | Download full JSON or per-entity CSV exports | None | **Not available.** |
| Help, onboarding, and web navigation | First-run guidance, empty states, app navigation, and help/about information | None | **Web-only.** |

The production target is a Cloudflare Worker at `https://mcp.kwartrack.com/mcp`. The existing React
site remains a separate Cloudflare Pages deployment.

## Security model

1. ChatGPT discovers Supabase Auth through Kwartrack's protected-resource metadata.
2. Supabase runs OAuth 2.1 authorization code + PKCE and redirects the user to
   `https://kwartrack.com/oauth/authorize` for consent.
3. ChatGPT sends the resulting Supabase access token to the MCP Worker.
4. The Worker validates the token and creates a Supabase client with that exact bearer token.
5. Existing RLS limits every query to `auth.uid()`.
6. Restrictive database policies reject direct writes from JWTs containing an OAuth `client_id`
   claim. The only exception is the validated, idempotent `mcp_create_expense` RPC.
7. Restrictive SELECT policies allow first-party sessions and only Kwartrack's registered ChatGPT
   `client_id`; every other OAuth client is denied.

The MCP service never receives a Supabase secret/service-role key.

See the official [OpenAI authentication guide](https://developers.openai.com/apps-sdk/build/auth)
and [Supabase MCP authentication guide](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication).

## Local development

Bootstrap the local Supabase stack and frontend as usual. Copy `.dev.vars.example` to `.dev.vars`,
then replace the publishable-key placeholder with the local key from `pnpm supabase:status`.

```bash
pnpm bootstrap
pnpm dev
pnpm mcp:worker:dev
```

The local MCP endpoint is `http://127.0.0.1:8787/mcp`. OAuth-server setup is currently easiest to
exercise against the hosted Supabase project; ordinary local Supabase user JWTs can still test every
tool and RLS query.

## Verification

```bash
pnpm mcp:test          # contract tests; RLS integration test runs when local credentials exist
pnpm mcp:build         # strict TypeScript build
pnpm mcp:worker:build  # Wrangler production-bundle dry run
```

The optional RLS integration test reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_SECRET_KEY` from the repository's `.env.local`. It creates two disposable users and proves
that each bearer token sees only its own accounts.

## Production deployment

The Worker configuration declares the `mcp.kwartrack.com` custom domain. Add the two Worker secrets
once from inside `apps/mcp`:

```bash
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

`SUPABASE_PUBLISHABLE_KEY` is safe for user-scoped requests; storing it as a Worker secret simply
keeps environment configuration in one place. Never add `SUPABASE_SECRET_KEY` or a legacy
service-role key to the Worker.

After setup, pushes to `main` automatically deploy MCP or workspace changes through
`.github/workflows/ci.yml`. The deployment runs only after validation and any required database
migration and preserves the Worker secrets already stored in Cloudflare. Health verification is
manual because Cloudflare edge security may reject GitHub-hosted runner traffic. Manual fallback
remains `pnpm worker:deploy` from this directory.

After the first deployment, verify:

```bash
curl https://mcp.kwartrack.com/health
curl https://mcp.kwartrack.com/.well-known/oauth-protected-resource
```

An unauthenticated request to `/mcp` should return `401` with a `WWW-Authenticate` header pointing
to the protected-resource metadata.

## Supabase dashboard setup

1. Confirm the Auth Site URL is `https://kwartrack.com`.
2. Add `https://kwartrack.com/oauth/authorize` to allowed redirect URLs for social sign-in.
3. Use asymmetric JWT signing keys (RS256 or ES256); OIDC ID tokens require them.
4. Under Authentication → OAuth Server, enable OAuth 2.1.
5. Set Authorization Path to `/oauth/authorize`.
6. Enable Dynamic Client Registration and require user consent.
7. Deploy the new database migration and frontend before connecting ChatGPT.

After ChatGPT registers successfully, disable Dynamic Client Registration again. Existing registered
clients continue to appear under Authentication → OAuth Apps; audit this list regularly and revoke
anything unexpected. Temporarily re-enable dynamic registration only when recreating the ChatGPT app.

Dynamic registration lets ChatGPT register its exact callback URI automatically. Review registered
clients periodically because enabling DCR allows other MCP clients to request registration too.

## ChatGPT developer-mode setup

Once the frontend, migration, Worker, and OAuth settings are live:

1. Open ChatGPT settings and enable developer mode.
2. Create/connect an app using `https://mcp.kwartrack.com/mcp`.
3. Choose the OAuth dynamic-registration flow when prompted.
4. Sign in to Kwartrack and approve the limited-access consent screen.
5. Test all six tools with explicit dates and known account values. Confirm that
   `create_transaction` prompts for manual approval and that retrying its idempotency key does not
   duplicate the expense.
6. Revoke the connection from Kwartrack Settings → Profile and confirm ChatGPT can no longer query.

Public submission should happen only after developer-mode testing and review of the current
[plugin submission requirements](https://developers.openai.com/apps-sdk/deploy).
