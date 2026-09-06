# Security Policy

Kwartrack handles financial data, so reports that could affect confidentiality,
integrity, authentication, authorization, or data isolation are taken seriously.

## Supported version

Security fixes are applied to the latest commit on `main`. Older releases and the
legacy `v1-final` tag are not supported.

## Reporting a vulnerability

Do not open a public issue or include exploit details in a public pull request.
Use GitHub's **Report a vulnerability** form under the repository's Security tab.
If private vulnerability reporting is unavailable, email `support@kwartrack.com`
with the subject `Kwartrack security report`.

Include, when possible:

- the affected component and commit;
- reproduction steps or a minimal proof of concept;
- the likely impact;
- suggested mitigations; and
- whether the issue is already being exploited.

You should receive an acknowledgement within seven days. Please allow reasonable
time for investigation and remediation before disclosure.

## Scope notes

- Never submit real financial records, production database dumps, access tokens,
  passwords, or Supabase service-role keys in a report.
- The public demo credentials work only against the disposable local Supabase stack.
- Local Supabase uses development credentials and must not be exposed publicly.
