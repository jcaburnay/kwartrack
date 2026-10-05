# Database regression checks

Start and reset **local** Supabase before running these tests:

```sh
pnpm supabase:start
pnpm supabase:reset
pnpm exec supabase test db
```

The monthly time-deposit suite covers calendar posting, actual-day interest,
compounding, catch-up, rounding, funding dates, maturity, pauses, permissions, independent income schedules, occurrence limits, and retired tag cleanup.

The migration replay check uses psql because the Supabase test container mounts
only the test directory, not the migration files referenced by this check:

```sh
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/tests/monthly_time_deposit_migration.psql
```

Expect twenty-nine `ok` assertions and no `not ok` assertions. All checks create only
synthetic data and roll back all fixtures and schema changes.
