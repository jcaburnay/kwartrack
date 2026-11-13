# Independent reviews — custom budget periods

Two agents independently reviewed the implementation against the approved design.
Neither agent edited code or consulted the other reviewer.

## Database integrity, migration, and security

Reviewer: review_database.

- Found a stale-tab copy could replace allocations added to the target after
  the UI loaded. The copy RPC now checks the target under the owner lock and
  rejects a populated target without modifying it.
- Found restoring a migrated custom period to its original calendar month
  did not refresh the legacy allocations. Synchronization now rebuilds that
  snapshot atomically before restoring compatibility, including cap reductions.
- No evident ownership/RLS/OAuth bypass found by inspection. The reviewer
  requested additional OAuth and populated-database migration coverage.

## Budget behavior, UI, and reporting

Reviewer: review_behavior.

- Found returning to a cached period after an intervening transaction edit
  could retain stale totals. Shared-store freshness now depends on store
  identity as well as invalidation version.
- Requested a genuine default-date MCP test across timezone midnight; added.
- Inclusive boundaries, gaps, edited end dates, transaction drill-downs,
  MCP selector separation, and exports were otherwise consistent by inspection.

## Resolution evidence

All three material findings were reproduced by failing regression tests before
fixes, then passed together (12 tests). Additional verification covers approved
OAuth reads/blocked writes, migration of an already-populated local monthly
budget, and headless browser creation in corporate/business at desktop/mobile
sizes. The final test/build counts and local lint limitation are recorded in
this task's handoff. No remote deployment or push is part of this change.

## PR review follow-up: tag deletion cascades

The automated review on PR #23 found that the custom-date legacy-write guard
also rejected FK cascade cleanup when deleting an otherwise-unused tag. A local
integration regression reproduced the refresh error. The guard now distinguishes
cleanup by checking that the referenced tag is already gone; direct legacy
allocation deletes with a live tag remain blocked. Tests cover both retained
and already-removed canonical allocations, preserve unrelated allocations, and
verify the custom period's dates and cap remain unchanged.
