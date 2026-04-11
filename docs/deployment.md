# Deployment Guide

Production deployment for Kwartrack using Cloudflare Pages, Clerk, and SpacetimeDB Maincloud.

## Architecture

| Service | Role | Cost |
|---|---|---|
| Cloudflare Pages | Frontend hosting + CDN | Free |
| Cloudflare DNS | Domain management | Free |
| Clerk | Authentication (production instance) | Free (under 10k MAU) |
| SpacetimeDB Maincloud | Backend database | Free |
| kwartrack.com | Custom domain | ~$10.46/year |

---

## Code Changes Required

### 1. SPA Redirect Rule (`public/_redirects`)
Cloudflare Pages requires this for React Router to work on direct URL access and page refreshes:
```
/* /index.html 200
```

### 2. Commit `src/module_bindings/`
The auto-generated SpacetimeDB client bindings must be committed to the repo so Cloudflare Pages can build without the SpacetimeDB CLI. Remove `src/module_bindings/` from `.gitignore`.

> **Important:** Whenever you change the server schema, run `pnpm generate` and commit the updated bindings along with the schema changes.

---

## Deployment Steps

### 1. SpacetimeDB — Publish Production Module

```bash
spacetime publish kwartrack --module-path server
```

To clear and republish:
```bash
spacetime publish kwartrack --module-path server --clear-database -y
```

- Production database name: `kwartrack`
- Development database name: `kwartrack-dev`

### 2. GitHub — Push Repository

```bash
gh repo create kwartrack --private --source=. --remote=origin --push
```

### 3. Clerk — Create Production Instance

1. Go to [clerk.com](https://clerk.com) → your app → switch to **Production**
2. Select **Clone development instance**
3. Enter your custom domain (`kwartrack.com`)
4. Add the DNS records Clerk provides to Cloudflare DNS (all as **CNAME**, **DNS only** — grey cloud):

| Name | Target |
|---|---|
| `clerk` | `frontend-api.clerk.services` |
| `accounts` | `accounts.clerk.services` |
| `clkmail` | `mail.ametpnkq@ez1.clerk.services` |
| `clk_domainkey` | `dkim1.ametpnkq@ez1.clerk.services` |
| `clk2_domainkey` | `dkim2.ametpnkq@ez1.clerk.services` |

5. Click **Verify configuration** in Clerk — wait for all records to go green
6. Copy the **Publishable key** (`pk_live_...`) from **API Keys**

### 4. Google OAuth — Configure for Production

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → OAuth consent screen** → fill in app name and support email
3. **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://kwartrack.com`
   - Authorized redirect URIs: `https://clerk.kwartrack.com/v1/oauth_callback`
4. Copy Client ID and Client Secret
5. In Clerk → **SSO Connections → Google** → enable **Use custom credentials** → paste credentials

### 5. Cloudflare Pages — Deploy Frontend

1. **Workers & Pages → Create → Pages → Connect to Git** → select `kwartrack` repo
2. Configure build:
   - **Production branch**: `main`
   - **Build command**: `pnpm build`
   - **Build output directory**: `dist`
3. Add environment variables:
   ```
   VITE_CLERK_PUBLISHABLE_KEY = pk_live_...
   VITE_SPACETIMEDB_URI       = wss://maincloud.spacetimedb.com
   VITE_SPACETIMEDB_MODULE    = kwartrack
   ```
4. Click **Save and Deploy**

### 6. Custom Domain

1. **Cloudflare Pages → kwartrack project → Custom domains → Set up a custom domain**
2. Enter `kwartrack.com` → Cloudflare auto-adds the DNS record (Proxied)
3. Click **Activate domain** → **Check DNS records**
4. Wait for status to show **Active + SSL enabled**

---

## Ongoing Maintenance

| Task | When | Command |
|---|---|---|
| Deploy frontend | Push to `main` — automatic | `git push` |
| Deploy backend | After server schema/logic changes | `pnpm server:publish` |
| Regenerate bindings | After server schema changes | `pnpm generate` then commit |
| Renew domain | Annually (Apr 12) | Auto-renews via Cloudflare |
