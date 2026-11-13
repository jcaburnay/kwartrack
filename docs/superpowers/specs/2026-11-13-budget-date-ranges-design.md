# Custom budget periods — proposed design

Status: approved in conversation on 2026-11-13; implemented on investigate/budget-exact-dates. See the implementation plan and independent review report.

## Intent and confirmed behavior

Replace calendar-month budget selection with manually created date ranges.
Both dates are inclusive: November 15–December 15 includes expenses on both
15ths. A subsequent budget can start December 16, December 21, or later.
Gaps are allowed; creating a budget does not create the following budget.

The end date initially defaults to the same day of the next month and remains
editable. Proposed edge rule: January 31 defaults to February 28, or February
29 in a leap year. Changing the start date updates the suggested end date
until the user edits the end date; afterward preserve that edit and validate.

## Approaches

- **Explicit periods (recommended):** start/end dates identify each budget;
  supports the requested irregular ranges and gaps.
- **Repeating monthly cycle:** convenient for a fixed payday schedule, but
  adds scheduling rules and does not naturally cover irregular gaps.

The user's clarification supports explicit periods. Automatic recurrence,
rollovers, income budgeting, and prorating caps are outside this change.

## Proposed rules to review

- A user's periods cannot overlap, including shared boundary dates. Enforce
  this in Postgres, including concurrent writes, as well as in the form.
- Allow one-day periods. Reject invalid dates and end dates before start.
- Use date-only values; determine today's date in the profile timezone.
- In a gap, show “No active budget” and offer to create one. Keep earlier
  periods accessible; do not silently use the previous budget as active.
- Expenses in gaps remain in transaction history and calendar reports but
  belong to no budget. No zero-cap warnings for gaps.
- Copying copies cap/allocation amounts only, never dates or actual spending.
- Editing period dates recalculates actuals without changing transaction dates.
- Keep the existing allocation-total <= overall-cap rule and split-share math.

## Data and deployment

Introduce a period identity shared by the overall cap and all tag allocations.
Use inclusive Postgres DATE boundaries and a per-user database exclusion rule
for overlapping ranges. Protect period ownership through RLS and owned foreign
references. Prefer new period/allocation tables alongside the monthly tables
so existing monthly clients continue to work during the rollout.

Backfill the union of existing config/allocation months into first-through-last
day periods. Preserve caps, allocations, owners, and historical months; do not
infer periods from transactions or discard zero-cap signup records. Inspect
for orphan allocations or inconsistent caps and fail visibly rather than
silently correcting financial values.

Deployment must account for CI applying migrations before deploying clients.
During transition, keep monthly writes mirrored into migrated periods with
transactional synchronization. New custom periods do not attempt to fit the
old monthly schema. Old monthly interfaces remain operational but retain
monthly semantics until their consumers migrate. Explicitly document this
transition; remove legacy structures only in a separate release.

Add a split-aware, read-only range aggregation RPC using date bounds, RLS,
and the existing exclusion of child transactions. Do not derive range totals
from the monthly budget_actuals view: it has already lost daily detail.

## Product integration

Replace the month picker with saved-period selection and a create/edit period
form. Display both dates beside the cap and allocations. Open the active
period by default; during gaps open the no-active-budget state.

Budget history compares saved periods and labels their full ranges. Retain
calendar-month cash-flow and spending-trend reports. Transaction drill-downs
receive the selected start/end dates. Active-budget progress, warning badges,
and remaining-day text use the active period's inclusive end date.

Add MCP period selection by period ID or an as-of date, defaulting to today.
Preserve the existing month argument's calendar-month reporting behavior as
a legacy interface; do not arbitrarily select one of multiple periods touching
that month. Overview responses distinguish monthly cash flow from period
budget progress. Export the new period records and allocations in JSON/CSV.

## Implementation sequence

1. Database migration and integration tests: backfill, ownership, cap checks,
   concurrent overlap prevention, monthly-client compatibility, range actuals.
2. Typed period queries/mutations, default-date utility, active-period lookup,
   range actuals, and cache invalidation after budget/transaction/split changes.
3. Period selection and editing, allocation workflows, copying, history,
   date-filtered drill-downs, and gap empty states.
4. Dashboard/badge integration, MCP contracts and reporting, data exports,
   and updates to specs.md describing the new behavior.
5. Full verification and deployment-compatibility review before handoff.

## Code areas identified

- supabase/migrations/; supabase/seed.sql; apps/web/src/types/supabase.ts
- apps/web/src/hooks/useBudget.ts, useBudgetActuals.ts, useBudgetHistory.ts,
  useOverallBudgetHistory.ts, useBudgetOverage.ts
- apps/web/src/components/budget/ and components/panels/BudgetPanel.tsx
- apps/web/src/pages/JigsawPage.tsx; utils/overviewAggregation.ts
- apps/web/src/utils/budgetHistory.ts, overallBudgetHistory.ts, dataExport.ts
- apps/mcp/src/types.ts, tools.ts, supabase.ts and corresponding tests

## Acceptance and validation

- Nov 15 and Dec 15 count; Nov 14 and Dec 16 do not.
- Nov 15–Dec 15 followed by Dec 21–Jan 21 is valid; Dec 16–20 has no active budget.
- A second period starting Dec 15 is rejected; Dec 16 is accepted.
- Verify same-day periods, leap years, January 31 defaults, year boundaries,
  manually edited end-date preservation, and profile timezone boundaries.
- Verify migrated monthly totals match previous totals, including split shares,
  Others, system tags, zero caps, and future/historical months.
- Verify cross-user isolation, concurrent overlapping creates, copied amounts,
  rejected cap reductions, date edits, and cache refresh after split edits.
- Verify MCP legacy/new requests and exports; both corporate/business themes,
  keyboard controls, and narrow/desktop viewports.
- Run pnpm supabase:reset and pnpm types:gen against local Supabase only.
- Run pnpm run ci, pnpm test, pnpm build, pnpm mcp:test, pnpm mcp:build,
  and pnpm mcp:worker:build. Integration tests must actually execute with the
  local test key rather than being counted as passing when skipped.

## Delivery

The implementation plan is ../plans/2026-11-13-budget-date-ranges.md. Two
independent reviews are recorded in ../reviews/2026-11-13-budget-date-ranges.md.
Work remains on investigate/budget-exact-dates; the phase branch and unrelated
apps/auth-lab/ and infra/ files are untouched. No remote deployment is included.
