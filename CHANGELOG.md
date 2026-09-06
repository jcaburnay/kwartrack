# Changelog

Notable changes to Kwartrack are documented here. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses Conventional
Commits. Published versions follow Semantic Versioning.

## Unreleased

## [1.0.0] - 2026-09-06

### Added

- Public landing page and self-hosting documentation.
- MIT license and open-source community documentation.
- Reproducible local setup with synthetic demo data.

### Security

- Updated web and MCP dependencies to versions without known production vulnerabilities.

### Fixed

- Made synthetic budget seeding use the demo user's Manila timezone.
- Hid Google authentication unless the provider is explicitly enabled.
- Kept the authenticated dashboard out of the logged-out landing bundle.
- Documented the Supabase Auth redirect settings required by self-hosted deployments.

The earlier SpacetimeDB and Clerk implementation remains available at the
`v1-final` tag.

[1.0.0]: https://github.com/jcaburnay/kwartrack/releases/tag/v1.0.0
[Unreleased]: https://github.com/jcaburnay/kwartrack/compare/v1.0.0...HEAD
