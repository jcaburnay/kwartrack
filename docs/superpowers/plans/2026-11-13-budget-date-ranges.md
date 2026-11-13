# Custom Budget Periods Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track steps below. Finish with two independent reviews as requested by the user.

**Goal:** Budget arbitrary inclusive date ranges with an editable next-month end-date default.

**Architecture:** Add canonical budget_period and budget_period_allocation tables alongside legacy monthly tables. Backfill and mirror monthly writes during deployment, aggregate daily expenses through RLS-aware RPCs, and migrate first-party UI and MCP consumers to explicit period identities.

**Tech Stack:** Existing React/TypeScript, Supabase/Postgres, DaisyUI, Vitest, pnpm.

**Spec:** ../specs/2026-11-13-budget-date-ranges-design.md (approved in conversation).

## Global Constraints

- Both dates inclusive; gaps allowed; overlapping periods forbidden per user.
- Default end date is same day next month, clamped to month's final day.
- No automatic recurrence, rollover, or cap proration.
- Local Supabase only; additive migrations; preserve legacy monthly clients during rollout.
- Preserve split-share math, child-expense exclusion, owned references, and OAuth restrictions.
- Work on investigate/budget-exact-dates, leaving unrelated files untouched.

## Review Focus

- Concurrent allocation writes cannot exceed the period cap.
- Cross-user period IDs and tags cannot bypass RLS through RPCs or foreign keys.
- An old client cannot overwrite a period that has been changed to custom dates.
- A gap cannot silently display the previous period as active.
- Midnight, leap-year boundaries, and saved end-date edits preserve date-only semantics.

### Task 1: Date semantics and database

**Files:** Create utils/budgetPeriod.ts and __tests__/budgetPeriod.test.ts under apps/web/src; create supabase/migrations/*_budget_periods.sql; create apps/web/src/__tests__/budgetPeriods.integration.test.ts; regenerate types/supabase.ts.

**Interfaces:** BudgetDateRange = {start_date:string;end_date:string}; defaultBudgetEnd(start:string):string; periodLabel(range:BudgetDateRange):string; periodPacing(range,todayISO):{totalDays:number;elapsedDays:number;daysLeft:number}. Database tables budget_period(id,user_id,start_date,end_date,overall_centavos,legacy_month,created_at,updated_at), budget_period_allocation(id,user_id,period_id,tag_id,amount_centavos,created_at,updated_at). RPC budget_range_actuals(p_start:date,p_end:date) returns tag_id/actual_centavos; copy_budget_period(p_target:uuid,p_source:uuid) copies amounts atomically.

- [x] Write tests for inclusive Nov 15–Dec 15 (31 days), Dec 21 gap, Jan 31 clamp/leap year, identical-day periods, future/past pacing, and invalid/reversed dates; run and observe failure.
- [x] Implement date helpers; run targeted test to PASS.
- [x] Write database tests for overlaps including shared boundary, gap acceptance, concurrent overlaps, cap reductions/concurrent allocations, copy rollback, legacy synchronization, owned references, and range actuals; run against local DB and observe missing-table failure.
- [x] Implement additive schema/backfill/RLS/triggers/RPCs. Serialize budget writes per owner to protect cap invariants. Preserve legacy records and document compatibility errors for converted periods.
- [x] Reset local DB, regenerate types, run new integration suite to PASS; no skipped tests accepted as evidence.

### Task 2: Period data and active budget

**Files:** hooks/useBudget.ts, useBudgetActuals.ts, useBudgetHistory.ts, useOverallBudgetHistory.ts, useBudgetOverage.ts, sharedStore.ts, useTransactionVersion.ts; create hooks/useBudgetPeriods.ts and useBudgetPeriodHistory.ts.

**Interfaces:** useBudgetPeriods exposes periods/loading/error and create/update mutations; useBudget(period:BudgetPeriod|null) keeps cap/allocation methods; useBudgetPeriodHistory(periods:readonly BudgetPeriod[]) returns tag/overall chart rows labeled with complete ranges. BudgetConfig and BudgetAllocation aliases point to canonical rows.

- [x] Add tests for active selection, absent active period in gaps, transaction/split/budget invalidation and period history boundaries; run failing tests.
- [x] Implement canonical queries, RPC aggregation, atomic copy, mutation errors and shared invalidation. Use a live profile-local date for active selection.
- [x] Run targeted tests and type-check, confirming no cross-period stale response replaces selected data.

### Task 3: Period UI and drill-downs

**Files:** components/budget/BudgetWorkspace.tsx, BudgetAnchor.tsx, BudgetTableView.tsx, EditOverallModal.tsx, BudgetTagHistoryView.tsx; create BudgetPeriodModal.tsx; components/panels/BudgetPanel.tsx; pages/JigsawPage.tsx; utils/budgetMath.ts, pacingMath.ts, budgetSorting.ts; corresponding tests.

**Interfaces:** onDrillToTag(tagId:string,range:BudgetDateRange):void; BudgetPeriodModal accepts initial range/cap and onSave(range,cap):Promise<string|null>. Pacing helpers accept explicit ranges while retaining existing calendar-month consumers.

- [x] Write UI tests for end default, manual-end preservation, inclusive help text, invalid ranges, overlap errors, create/edit, gaps, saved selection, copy, and exact drill-down dates; observe failure.
- [x] Replace month picker with saved-period selection and create/edit form; keep existing semantic styling and history selection persistence. Add period-count history controls.
- [x] Verify targeted UI tests; inspect corporate/business at narrow and desktop sizes using headless browser.

### Task 4: Reporting, export, and spec

**Files:** apps/mcp/src/types.ts, tools.ts, supabase.ts and tests; apps/web/src/utils/dataExport.ts, overviewAggregation.ts and tests; specs.md; supabase/seed.sql if necessary.

**Interfaces:** FinanceDataSource.getBudgetPeriodStatus({periodId?:string;asOf?:string}):Promise<PeriodBudgetStatus>; null period denotes a gap. Keep getBudgetStatus(month) as explicitly legacy monthly reporting. MCP rejects combined month/period/date selectors; default uses current profile-local date. Summary output identifies budget basis and period separately from monthly cash flow.

- [x] Write tests for period/default/gap reporting, invalid mixed selectors, unchanged legacy month requests, and exported period data; observe failure.
- [x] Implement read-only period reporting and exports; update specification and transition documentation without changing calendar spending trends.
- [x] Run web/MCP targeted tests to PASS.

### Task 5: Verification and two independent reviews

- [x] Run pnpm run ci, pnpm test, pnpm build, pnpm mcp:test, pnpm mcp:build, pnpm mcp:worker:build; confirm local integration tests executed.
- [x] Run mechanical UI detector once and inspect both themes/viewports; fix functional defects in one batch.
- [x] Independent reviewer A checks database integrity, migration/deployment safety, RLS/OAuth, ownership, and concurrency.
- [x] Independent reviewer B checks user-visible behavior, date boundaries, UI accessibility, history/drill-down consistency, MCP and exports.
- [x] Resolve material findings with regression tests and rerun affected verification. Report remaining limitations truthfully. Do not push or create a PR without the user's approval.

## Verification limitation

Repository-wide `pnpm run ci` still reports formatting in the unrelated, untracked
`apps/auth-lab/.local-config.json` and `infra/terraform/local/local.auto.tfvars.json`.
They were left unchanged. Biome passes across web, MCP, repository scripts,
GitHub configuration, and root package/configuration files. Independent review
findings and fixes are recorded in ../reviews/2026-11-13-budget-date-ranges.md.
