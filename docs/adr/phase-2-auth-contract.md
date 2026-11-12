# KT-0010 — local authentication contract and compatibility

Date: 2026-11-10. Status: compatibility experiment passed locally; no production
authentication, global API guard, permanent user pool, or browser auth UI is
implemented by this ticket. Final assertions passed again on 2026-11-12 with
AWS CLI 2.40.0; the original experiment used the baseline below.

## Baseline and scope

The experiment uses the existing Node 24.22.1/pnpm 10.34.5 workspace, Floci 2.4.0,
Docker 29.9.2 on macOS arm64, and AWS CLI 2.39.6. The Phase 1 real PostgreSQL and
Gateway → VPC Link → ALB → Nest path passed setup again before this experiment.
The first GitHub-hosted validation run and destructive database reset rehearsal
remain outstanding Phase 1 verification items; neither blocks this bounded probe.

Run `pnpm local:setup`, then `pnpm local:auth:probe`. The probe creates a uniquely
named, tagged disposable user pool with a public client and synthetic users,
prints assertions and claim names only, and deletes that pool in `finally`.
Passwords are randomly generated. CLI inputs use a mode-600 file in a temporary
directory, which is removed on completion; tokens/passwords are never printed or
passed as command-line values. Existing pools, users, database records, and
Supabase sessions are not modified. A cleanup failure makes the command fail.

## Decisions for subsequent tickets

- Use a Cognito user pool with email sign-in and a public app client without a
  client secret. Enable `ALLOW_USER_PASSWORD_AUTH` and
  `ALLOW_REFRESH_TOKEN_AUTH`; use non-rotating refresh for the initial local lab.
  Target access/ID lifetime is 15 minutes. Keep admin setup out of the browser.
- The future isolated auth page uses `http://127.0.0.1:5174` or
  `http://localhost:5174`. Tokens remain in memory; reload signs out. Sign-out
  clears client state even if revocation fails. A session-generation guard must
  discard delayed refresh/API responses after sign-out or user switch.
- Accept only access JWTs: RS256, exact configured `iss`, exact allowed
  `client_id`, `token_use=access`, nonempty `sub`, valid expiry and issue time.
  An ID token's `aud` is not a replacement for the access token's `client_id`.
  Use five seconds of clock tolerance. KT-0012 implements the real verifier;
  the probe's crypto assertion is deliberately not exported as an auth service.
- Resolve identity to an internal UUID using a unique `(issuer, subject)` pair.
  Email is mutable profile information, never the ownership or relinking key.
  Owned queries and mutations must constrain both record ID and internal owner.
  Request headers, body fields, and query parameters cannot establish ownership.
- Routes become protected by a global Nest guard, with explicit public health
  routes. Backend verification remains mandatory through direct, ALB, and gateway
  entry points; the later gateway JWT authorizer supplements it.
- Return 401 for absent/invalid tokens, 403 for a valid principal lacking an
  explicit capability, and 404 for both missing and foreign-owned resources.
  Uncached JWKS/identity dependency outages return a bounded 503. A successful
  trusted key refresh with no matching key still rejects the token.

## Issuer and key-fetch address contract

For the pinned Compose hostname, tokens and discovery from both host and container
advertise the same canonical issuer: `http://floci:4566/<pool-id>`.

| Setting | Host process | API container |
| --- | --- | --- |
| Expected issuer | `http://floci:4566/<pool-id>` | same exact value |
| Trusted JWKS fetch URL | `http://127.0.0.1:4566/<pool-id>/.well-known/jwks.json` | `http://floci:4566/<pool-id>/.well-known/jwks.json` |
| Cognito operation endpoint | `http://127.0.0.1:4566` | `http://floci:4566` |

Separate issuer validation from key-fetch reachability. Configure the pool and
trusted URLs explicitly; never follow an incoming JWT's issuer, `jku`, or `x5u`.
The planned `jose` verifier should use a two-second fetch timeout, bounded key
cache, and controlled unknown-key refresh. No network calls belong inside a
financial transaction or owner lock.

## Observed compatibility matrix

| Operation | Result on pinned local Floci |
| --- | --- |
| Public client creation | No client secret returned |
| Admin-created, permanently confirmed synthetic user sign-in | Access, ID, and refresh tokens issued |
| Access JWT signature | RS256 verified against trusted local JWKS |
| Access claims | Exact discovery issuer/client, UUID subject, `token_use=access`, 900-second lifetime |
| ID token | Distinct `token_use=id`; must not authorize API calls |
| Host/container discovery and JWKS | Same issuer and key IDs |
| Wrong password | `NotAuthorizedException` |
| Disabled user sign-in | `NotAuthorizedException` |
| `REFRESH_TOKEN_AUTH` | Fresh access token retains user subject |
| `RevokeToken` then refresh | Refresh rejected with `NotAuthorizedException` |
| Existing access JWT after refresh revocation | Signature still verifies; offline verification alone cannot enforce immediate logout |
| Browser-origin preflight and public sign-in | Allowed origin echoed, requested SDK headers allowed |
| Untrusted browser origin | No allow-origin header |
| Public `SignUp` | Unconfirmed user and delivery metadata returned |
| `ResendConfirmationCode` | Request succeeds |
| Admin-assisted confirmation and subsequent sign-in | Succeeds |
| `ForgotPassword` | Delivery metadata returned |
| Invalid `ConfirmForgotPassword` code | `CodeMismatchException` |

The original Compose configuration returned HTTP 405 for the auth-page preflight.
The failing probe reproduced it. Adding the two exact lab origins and the SDK
header names through Floci's CORS configuration made preflight and origin-bearing
sign-in pass; an untrusted origin remains denied. CORS is a browser transport
policy, not API authorization. An actual browser/SDK harness is still KT-0016.

Public confirmation using a correct emailed code, correct-code password reset,
actual email delivery, PKCE/managed login, refresh rotation, and immediate global
access-token revocation were not tested. They are not implied by admin-assisted
confirmation or a successful recovery request. The later lab must either prove a
safe local code-delivery mechanism or display these operations as unavailable.

## Handoff and references

KT-0011 now provisions the permanent pool/client and repeatable Alice/Bob
fixtures; see the [local auth guide](../local-auth.md). The Cognito Terraform
endpoint is included in the fail-closed endpoint map. KT-0013 must
also establish basic profile initialization/read fields before consumers need
display name, timezone, and theme; preference editing can remain later.

- [Floci Cognito operations and discovery](https://floci.io/floci/services/cognito/)
- [Floci browser CORS configuration](https://floci.io/floci/configuration/environment-variables/#browser-cors)
- [AWS InitiateAuth flow distinctions](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html)

These references informed the experiment; the matrix reports actual local
observations, not a claim of hosted AWS parity.
