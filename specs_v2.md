# kwartrack — v2 Spec

Personal finance tracker. This spec defines v2, a clean rebuild of the current app (v1) on a new stack. v2 is a **fresh start**, not a refinement of the in-progress Supabase migration — the partial migration work is discarded. No data migration from v1; users start fresh on v2.

## Stack

### Frontend
1. Vite — React w/ TypeScript
    1. vite
    2. vitest
2. React Router
3. React Hook Form
4. TailwindCSS (DaisyUI)
5. Recharts

### Backend
1. Supabase
    1. Auth
    2. Database
    3. Realtime (nice-to-have for v2.0 — not a hard requirement for MVP)
    4. Storage

### Tools
1. pnpm
2. Biome

### Deployment
1. Cloudflare
    1. Domain Registrations
        1. kwartrack.com
    2. Workers & Pages Free Plan
2. Supabase Free Plan

## Assumptions & non-goals (v2.0)

- **Single-currency:** PHP only. Multi-currency is out of scope for v2.0 — **planned for v2.x** as *per-account currency with deferred FX*: each account has its own currency, balances display in their native currency (no auto-conversion), net worth shows side-by-side totals per currency rather than a single aggregated number. That approach avoids the FX-rates problem entirely and is the pragmatic middle ground between "PHP only" and full multi-currency support.
- **Single-user:** per-user data only, no sharing/collaboration.
- **Realtime:** nice-to-have. MVP can ship with fetch-on-mount + refetch-on-action and upgrade to live subscriptions later.
- **Mobile:** tables are horizontally scrollable on narrow screens. No separate card fallback; revisit if the scroll UX feels bad.
- **No v1 → v2 data migration.** Everyone starts fresh.

**Version convention used in this spec:**

- **v2.0** — the initial v2 release scope; everything this document describes unless marked otherwise.
- **v2.1** — specifically-planned next minor. Used for deferrals with a concrete target (bulk CSV import, account icons, drag-to-reorder, credit-card statement tracking).
- **v2.x** — "some later version, TBD." Used for features we're committing to eventually but haven't sequenced (multi-currency, keyboard shortcuts, tag emoji/color, custom tag ordering, net-worth-over-time chart).

## v1 → v2 simplifications (intentional)

Things v1 had that v2 does **not**:

- **Two-level account hierarchy flattened.** v1 modelled `account` (institution, e.g. "Maya") with child `sub_account` rows (the actual funded container, e.g. "Maya Wallet"). v2 flattens this: an `account` *is* the funded container, and an optional `group` takes over the institution-grouping role. Sub-accounts never drove budgeting in v1 — they modelled physical money pools — so the budget feature is unaffected by this change.

---

## Features

### Overview (dashboard)

Redesigned from v1. Acts as the landing route. Layout:

- **Hero strip** — three numbers side-by-side: **Total Assets**, **Total Liabilities**, **Net Worth** (see [Account types](#account-types) under Accounts for the Assets / Liabilities / Net Worth math). Drill-in behavior:
    - **Total Assets** → Accounts page, no filter.
    - **Total Liabilities** → Accounts page filtered to `credit` type accounts.
    - **Net Worth** → Accounts page, no filter. (A dedicated net-worth-over-time chart is a v2.x nice-to-have; skipped for v2.0.)

- **Monthly spend trend** — Recharts `LineChart`. Rolling last 12 months on the X-axis; total monthly `expense` amount (PHP) on the Y-axis. Single line. Tooltip on hover shows exact amount + month. Clicking a point drills to the Transactions page filtered to that month.

- **Budget progress** — condensed version of the per-tag progress bars defined on the Budget page. Current month only. One horizontal bar for **Overall** (mirrors the Budget hero), plus the **top 3–5 tags by actual spend**. Clicking a row drills to that tag on the Budget page.

- **Upcoming** — a "what needs attention soon" card listing up to ~5 items, mixed across three types:
    - **Recurrings firing in the next 7 days** — e.g. *"Spotify · ₱279 · in 3 days"*. Each item links to the recurring row.
    - **Unsettled loaned debts older than 14 days** — nudges collection. E.g. *"Bob owes ₱960 · Apr 10 (14 days)"*. Links to the debt in the Debts table.
    - **Budget tags over 80% with time left in the month** — early overage warning. E.g. *"`foods` at 87% · 12 days left"*. Links to that tag on the Budget page.
    - Each item has a type-indicator icon. Ordered by urgency: soonest recurrings first, then oldest debts, then budget warnings.
    - If there's nothing to show, the card renders a small empty state (*"You're all caught up 🎉"* or similar — nothing urgent).

Links out to Accounts, Budget, and Debts/Splits for additional drill-downs.

**No month-picker.** Overview is always a "right now" dashboard — Hero is current balances, Budget progress is current month, Upcoming is forward-looking, Monthly spend trend shows the rolling 12 months. Users who want a specific past month's Budget data go to the Budget page (which has its own picker); users who want to explore past transactions go to the Transactions filter bar.

**Responsiveness.** No dedicated mobile design — the dashboard just reflows:

- Hero strip — three numbers stack vertically on narrow screens.
- Charts shrink horizontally to fit (Recharts handles this natively).
- Budget progress bars and Upcoming card are natural lists; stack fine.

Consistent with the app-wide rule for mobile: same layout, just narrower.

**Empty state (new user, no accounts yet).** Hero strip still renders (all three numbers show ₱0 — keeps layout stable when data arrives). Monthly spend trend, Budget progress, and Upcoming card are collapsed into a single onboarding card:

```
  Welcome to Kwartrack 👋

  Get started by creating your first account.
  Cash, e-wallet, savings, credit card, or time deposit — your choice.

  [ + Create Account ]
```

The CTA opens the New Account flow (same as FAB → New Account). Once the user has at least one account, the full Overview layout renders; with one-but-no-transactions, individual widgets handle their own empty states (flat spend trend, empty Upcoming).

### Accounts (+ Transactions)

One combined page: the accounts table on top, transactions table below.

#### Accounts table

Accounts may be grouped under a user-defined container (e.g. "Maya" groups `Maya Wallet`, `Maya My Savings`, `Maya Personal Goal`).

Use DaisyUI pinned-row table: group rows are pinned headers above their member accounts. Group rows show a **live rollup** of member-account balances (updates whenever a member balance changes).

Flat example:

| Account         | Balance    |
| --------------- | ---------- |
| BPI Savings     | 3,664.08   |
| Maya Wallet     | 1,364.51   |
| Maya My Savings | 155,745.50 |

Grouped example:

| Account            | Balance      |
| ------------------ | ------------ |
| **BPI**            | 3,664.08     |
| BPI Savings        | 3,664.08     |
| **Maya**           | 257,270.19   |
| Maya Wallet        | 1,364.51     |
| Maya My Savings    | 155,745.50   |
| Maya Personal Goal | 100,160.18   |
| **RCBC**           | 271,288.96   |
| RCBC Savings       | 271,288.96   |

**New Group:** created **inline from the group picker** inside the New Account / Edit Account form — a "+ Create new group" option at the bottom of the dropdown (same pattern as "+ New person" on contacts, "+ Create tag" on tags). Form fields: `name` (string). Member accounts are assigned as each account is created or edited; a group picker doesn't set members directly. No standalone "New Group" button on the Accounts page — low-frequency action, doesn't need top-level UI. Full CRUD (rename, delete, reassign members) lives in Settings → Groups.

#### Ordering

- Accounts are sorted by group first: **ungrouped accounts appear at the top**, followed by each group in alphabetical order.
- Within each section (ungrouped or a specific group), accounts sort **alphabetically by `name`**.
- Archived accounts are hidden from the table by default and do not participate in sort.
- Manual drag-to-reorder is a v2.1 refinement.

#### Account types

Every account has a `type` that drives behavior:

| Type | Behavior |
| --- | --- |
| `cash` | Physical cash on hand. Counted as an **asset**. |
| `e-wallet` (default) | E-wallet / mobile money (Maya, GCash, etc.). Counted as an **asset**. |
| `savings` | Bank savings account. Counted as an **asset**. |
| `credit` | Credit card. Has `creditLimit`. Balance is outstanding debt — counted as a **liability**. See [Credit accounts](#credit-accounts) below. |
| `time-deposit` | Locked deposit. Has principal, interest rate, maturity date. Ported from v1. Counted as an **asset**. See [Time-deposit accounts](#time-deposit-accounts) below. |

**Assets, Liabilities, and Net Worth.** v2 reports three numbers, not one:

- **Total Assets** = sum of balances across all non-credit accounts (`cash`, `e-wallet`, `savings`, `time-deposit`). Always ≥ 0.
- **Total Liabilities** = sum of balances across all `credit` accounts, displayed as a positive number (e.g. "you owe ₱150,000").
- **Net Worth** = `Total Assets − Total Liabilities`. Can be negative.

Reporting the three side-by-side (instead of a single net-worth number) preserves accounting honesty while making the user's position legible: when liabilities spike, the user sees *why* Net Worth moved, because Assets stayed stable and Liabilities grew. Paying a credit card off reduces Assets and Liabilities by the same amount, leaving Net Worth unchanged — which is the correct behavior.

Group rollup rows in the Accounts table show a single **net** number (`assets − liabilities`) for scannability, styled red when negative; the full three-number breakdown lives on the Overview hero.

##### Shared validation (all types)

- `name` — required, 1–50 chars, must be **unique within the user's account list** (so transaction source/destination pickers are unambiguous).
- `initial-balance` — required; must be ≥ 0. Negative initial balances are disallowed for every type, including credit (an outstanding credit-card balance at creation is still stored as a positive debt amount).
- `initial-balance` **directly sets** the account's starting `balance` — no synthetic "opening balance" transaction is created. The account's balance is the source of truth; transactions change it going forward. A user who wants an opening deposit to appear in transaction history should create the account with `initial-balance = 0` and record an explicit `income` transaction.

##### Edit rules

- `name` — editable (subject to the uniqueness check).
- `initial-balance` — **not editable** post-creation. To correct the balance, the user records an adjustment transaction.
- `type` — **not editable**. The field set per type differs enough that changing type isn't a simple rename. If a change is genuinely needed, create a new account and transfer balance over.
- **Type-specific fields:**
  - `credit.creditLimit` — editable (banks raise/lower limits).
  - `time-deposit.principalCentavos` — **not editable** (historical fact; same rule as `initial-balance`).
  - `time-deposit.interestRateBps` — editable, though rare.
  - `time-deposit.maturityDate` — editable (supports rollovers / extensions).
  - `time-deposit.interestPostingInterval` — editable.

##### Delete and archive

Two distinct actions.

**Delete (hard-delete).** Forbidden if the account has any associated transactions (expense/income/transfer on either source or destination, plus any linked recurring rows or splits). Time-deposit accounts additionally cannot be deleted before `maturityDate` — the scheduled interest-posting job and linked recurring must not orphan. Deletion is reserved for accounts created in error.

**Archive.** The everyday "I don't use this anymore" action. Archived accounts:

- Are hidden from the main Accounts table by default (a toggle shows them again).
- Do not appear in transaction source/destination pickers (no new transactions can use them).
- Still appear in historical transaction listings (preserves audit trail).
- Are excluded from Assets, Liabilities, Net Worth, and group-rollup calculations.

Archive is a reversible toggle (`isArchived` boolean on the account). Users hit this when they close a card, fully withdraw a time deposit, or switch banks. It's the intended path for the vast majority of "retire this account" cases; hard-delete is for typos.

##### Credit accounts

**Stored fields (beyond the common `name` + `initial-balance`):**

| Field | Required | Notes |
| --- | --- | --- |
| `creditLimit` | yes | Maximum credit available. Must be `> 0`. |

**Balance convention.** Stored as positive centavos representing debt (e.g. `15000` = "you owe ₱150.00"). Credit balance rolls up into **Total Liabilities**, not Assets; see [Assets, Liabilities, and Net Worth](#account-types) under Account types.

**Validation at creation:**

- `initial-balance ≤ creditLimit` — you can't be over-limit at creation. (Overages via later transactions are allowed and flagged visually in the UI.)

**Derived on the fly, no storage:**

- `availableCredit` = `creditLimit − balance`
- `utilization` = used / `creditLimit`

**UI behavior:**

- *Accounts table.* Balance rendered with debt styling (red, or `(owed)` suffix). Compact utilization bar next to the balance.
- *Detail strip (when selected).* Shown between the accounts table and the transactions table: current balance, available credit, utilization bar. A **"Pay this card"** button opens a `New Transaction` modal pre-filled with `type = transfer`, `to = this card`; amount is left blank for the user to type.
- *No statement/due-date UI in v2.0.* Actual cut and due dates drift month-to-month (weekends, holidays, bank processing), so any derivation from a fixed day-of-month would be unreliable. Statement cycle tracking is deferred to v2.1 (manual SOA logging, if needed).

**How transactions interact with a credit account:**

| User action | Transaction |
| --- | --- |
| Swipe / purchase | `expense` with `from = this card` — balance goes up |
| Refund / reversal | `income` with `to = this card` — balance goes down |
| Pay the card | `transfer` with `from = <bank>`, `to = this card` — balance goes down |
| Annual/late fee, cash advance, posted interest | `expense` with `from = this card`, tagged appropriately (e.g. `bills`, `interest-paid`) |
| Convert purchase to installment (PH-specific) | Recurring row with `from = this card`, `interval = monthly`, `remaining-occurrences = N` |

##### Time-deposit accounts

Ported from v1's `time_deposit_metadata` model largely unchanged.

**Stored fields (beyond `name`):**

| Field | Required | Notes |
| --- | --- | --- |
| `principalCentavos` | yes | Original deposit amount. **Never changes** once created. |
| `interestRateBps` | yes | Annual rate in basis points. `600` = 6.00% p.a. Integer type — avoids floating-point drift on long-running computations. |
| `maturityDate` | yes | When interest stops accruing. Must be in the future at creation. |
| `interestPostingInterval` | yes | How often interest is credited. Values: `monthly \| quarterly \| semi-annual \| annual \| at-maturity`. Default: `monthly`. `at-maturity` posts a single interest transaction when `maturityDate` passes. |
| `isMatured` | flag, auto-managed | Flipped `false → true` by a scheduled job when `maturityDate` passes. |

**Validation at creation** (ported from `validateTimeDepositCreation` in v1's `server/src/helpers.ts`):

- `principalCentavos > 0`
- `interestRateBps > 0`
- `maturityDate > now`

**Balance behavior.** `balance` starts at `principalCentavos` and grows via periodic interest postings. Counted as an asset (same as e-wallet/savings). The delta `balance − principalCentavos` equals accrued interest to date.

**Interest accrual.** Ports v1's mechanism: a linked scheduled recurring generates `income` transactions tagged `interest-earned` with `to = this time deposit` at the `interestPostingInterval`. No on-the-fly balance extrapolation — every centavo of interest is an actual ledger entry, which keeps transaction history honest. For `at-maturity`, the scheduled job posts a single interest transaction on the day `maturityDate` passes.

**Maturity handling.** A scheduled job (pg_cron in v2) runs daily, finds time deposits whose `maturityDate` has passed, flips `isMatured`, and stops future interest postings. The matured balance stays in the account until the user transfers it out via a normal transfer.

**Derived on the fly, no storage:**

- `interestAccrued` = `balance − principalCentavos`
- `daysToMaturity` = days between today and `maturityDate` (≤ 0 once matured)
- `estimatedValueAtMaturity` = simple-interest projection: `principalCentavos × (1 + (interestRateBps / 10000) × yearsToMaturity)`. Displayed as an estimate; actual value depends on posting schedule and partial-period handling.

**UI behavior:**

- *Accounts table.* Show `balance` as current value. Subtle "Matured" badge when `isMatured` is true.
- *Detail strip (when selected).* Shown between the accounts table and the transactions table: a hero strip with current value, accrued interest (green), days-to-maturity, maturity date. Secondary row shows principal, interest rate (formatted as `6.00% p.a.`), interest posting cadence (e.g. "Posts monthly"), estimated value at maturity. No "Pay this card"-style action — time deposits are passive.

**Deliberately skipped for v2.0:**

- Compounding frequency control (monthly vs daily compounding). v1's model is simple periodic posting; v2 ports the same. Can refine later if real-use reveals the need.
- Early-withdrawal penalty math. If it matters, the user records the penalty as a normal `expense` when it posts.

#### New Account (two-step flow, launched from FAB)

1. **Pick type:** `cash | e-wallet | savings | credit | time-deposit`.
2. **Form reveals the fields relevant to the chosen type:**
    - `cash` / `e-wallet` / `savings`: `name`, `initial-balance`.
    - `credit`: `name`, `initial-balance`, `creditLimit`.
    - `time-deposit`: `name`, `principalCentavos`, `interestRateBps`, `maturityDate`, `interestPostingInterval` (default `monthly`).
3. **Optional group assignment** — a `group` dropdown appears at the end of every form, listing the user's existing groups plus a "None" option (default). An account belongs to **at most one group at a time**; membership can be changed later via account edit. The dropdown also includes a **"+ Create new group"** option at the bottom for inline group creation without leaving the form — it opens a tiny sub-modal asking just for the group name, then returns to the account form with the new group pre-selected.

#### Account selection (inline filter, no separate route)

Accounts do not have dedicated detail pages. Clicking an account row selects it in place, and two things happen on the same page:

1. The transactions table below filters to that account. Filter-bar filters compose on top (e.g. "this account AND tag=foods AND date in April").
2. A **detail strip** appears between the accounts table and the transactions table, showing type-specific information for the selected account. The strip contents live in the type-specific subsections above: [Credit accounts](#credit-accounts) defines the credit strip; [Time-deposit accounts](#time-deposit-accounts) defines the time-deposit strip. For `cash`, `e-wallet`, and `savings` accounts the strip is minimal (large balance + this-month inflow/outflow summary).

Clicking the same row again — or clicking a "Clear selection" chip on the detail strip — deselects and returns the transactions table to its unfiltered state.

Clicking a group pinned-row header selects the whole group: transactions filter to the group's member accounts, and the detail strip shows a mini summary for the group (Assets / Liabilities / Net). Clicking the group header again clears the group selection.

**URL state.** Selection is reflected as a query param: `?account=<slug>` or `?group=<slug>`. Same page, but bookmarkable and shareable.

#### Deferred to v2.1

- **Account icons / colors.** v1 supports per-account icons (`docs/superpowers/specs/2026-04-09-account-icons-design.md`). v2.0 relies on name + balance + type-specific visual cues (debt styling, utilization bars, matured badge) and does not port icons. Revisit if the accounts table feels visually flat in real use.
- **Drag-to-reorder.** v1 supports reordering sub-accounts. v2.0 uses a default sort (see [Ordering](#ordering) above); manual reorder is a v2.1 refinement.

#### Transactions table

Shown below the accounts table on the main Accounts page. When an account or group is selected in the table above, the transactions list filters to that selection (see [Account selection](#account-selection-inline-filter-no-separate-route)).

| amount | type     | tag   | from            | to          | fee | description       | date           |
| ------ | -------- | ----- | --------------- | ----------- | --- | ----------------- | -------------- |
| 1,500  | expense  | bills | Maya Wallet     |             |     | internet-converge | April 18, 2026 |
| 2,967  | expense  | bills | Maya Wallet     |             |     | electric bill     | April 18, 2026 |
| 4,500  | transfer | —     | Maya My Savings | Maya Wallet | —   | —                 | April 18, 2026 |
| ...    | ...      | ...   | ...             | ...         | ... | ...               | ...            |

**Sorting.** Default sort is `date` descending (newest first), with secondary sort by creation order descending (most recently created first) within the same date. Column headers are clickable to re-sort by any column. Sort preference is not persisted — the table always opens with the default on page load.

#### Filtering

Filter bar axes (compose on top of any implicit account/group filter from the route):
- By Group
- By Account (source and/or destination)
- By Date
- By Date range
- By Tag
- By Type (`expense | income | transfer`)

#### New Transaction

- `amount`: number — required, must be `> 0`.
- `type`: `expense | income | transfer` — required.
- `tag`: required for `expense` and `income`; **optional (nullable)** for `transfer`. See default tags below.
- `from`: source account. Required for `expense` and `transfer`; omitted for `income`.
- `to`: destination account. Required for `income` and `transfer`; omitted for `expense`.
- `fee`: number — **only shown on transfers**; hidden for `expense` / `income`. Optional on transfer; must be `> 0` when provided. When filled in, an inline helper line appears under the field: *"A paired `transfer-fees` expense of ₱X will also be recorded from \<source account\>."* See Transfer fees below.
- `description`: string — **optional**; empty allowed.
- `date`: date — required.

**Validation:**

- On `transfer`, `from` and `to` must be different accounts.
- Credit accounts are allowed on either side of a transfer (card-to-card balance transfers are a real use case).
- `date` can be anywhere in the past or future. No cap either direction — users may backfill long history or record a future-posting transaction ("I paid rent, posts tomorrow").
- Future-dated transactions **apply their balance effect immediately** (match v1 behavior). The `date` is informational, not scheduled.

**Pre-fill from context.** The `New Transaction` modal takes hints from whatever the user is looking at when they tap the FAB:

- **No account selected** (main Accounts view, no filter): no field is pre-filled. `type` defaults to `expense`.
- **An account is selected** (via inline filter): the modal opens with that account pre-filled as `from` for an expense/transfer, or as `to` if the user switches `type` to `income`. The user can override before saving.
- **A group is selected**: no account pre-fill (ambiguous which group member to pick). `type` still defaults to `expense`.
- **From the credit "Pay this card" button**: `type = transfer`, `to = this card`, `from = blank`, `amount = blank` (see [Credit accounts](#credit-accounts)).
- **Always, regardless of context:** `type` initially defaults to `expense`. Switching `type` dynamically relocates any pre-filled account between `from` and `to` as appropriate (expense/transfer uses `from`; income uses `to`).

#### Edit and delete

**Edit.** All fields are editable after creation — `amount`, `type`, `tag`, `from`, `to`, `fee`, `description`, `date`. There is no edit-window cutoff; users can amend transactions of any age.

- Editing `amount`, `type`, `from`, `to`, or `fee` triggers a **balance recompute**: the previous transaction's effect on account balances is reversed, and the edited transaction's effect is applied. Account balances stay consistent across any edit.
- **Type can be changed on edit** (e.g. `expense` → `transfer`). The form re-shows fields appropriate to the new type; required fields for the new type must be filled before saving. The re-compute handles the balance math regardless of which types are involved.
- Editing the `fee` on a transfer — including adding, removing, or changing it — keeps the paired `transfer-fees` expense transaction in sync: it's created, updated, or deleted to match the new fee state.

**Delete.** Hard-delete. A confirmation dialog is required (deletion is destructive and low-frequency).

- Reverses the balance effect on `from` / `to`.
- If the transaction is a transfer with a paired `transfer-fees` expense, the paired transaction is deleted at the same time.
- Transactions linked to a recurring (created by a recurring firing) can be deleted like any other; see Recurring for how that interacts with the recurring entity.

#### Auto-generated transactions (from Recurring)

When a recurring entity fires, it creates a real transaction tied to it.

**Data model.** Transactions carry an optional `recurringId` FK pointing at the originating recurring entity. `null` for manually-created transactions; set for auto-generated ones.

**UI.** In the transactions table, a small repeat icon appears next to the description on auto-generated rows. Hover / tap the icon for a tooltip showing the source recurring's name, with a link back to its row in the Recurring table. The edit modal shows the same link.

**Behavior:**

- Editing an auto-generated transaction is unrestricted. Changes do **not** propagate back to the recurring (it stays a separate entity with its own definition).
- Deleting an auto-generated transaction removes only that transaction. The recurring is untouched; the next occurrence will still fire on schedule.
- Deleting the **recurring** stops future firings but **does not delete past auto-generated transactions**. Historical records stay intact — if the user wants them gone they delete each one individually.

#### Transfer fees (paired ledger entry)

When a transfer transaction has a non-zero `fee`, a **paired expense transaction** is created automatically, tagged `transfer-fees`, sourced from the transfer's `from` account. This means:

- The source account's balance reflects both the transferred amount and the fee.
- Fees show up as their own line in Budget (under the `transfer-fees` tag) and in Overview reports.
- Deleting the original transfer also removes the paired fee transaction.

#### Deferred to v2.1

- **Bulk import** — CSV / bank statement import (e.g. pasting a BPI / Maya / UnionBank statement). Users manually enter transactions in v2.0.
- **Attachments** — per-transaction receipt images or files. v1 doesn't have this; v2.0 keeps parity.

### Recurring

Subscriptions and installments share a single "recurring" entity. The only difference is `remaining-occurrences`:
- Unset/null → subscription (no end).
- Set → installment (counts down until zero).

Recurrence is a **mechanic** (interval + optional remaining-occurrences), not a tag. Tags describe spend category independently.

Recurring income (e.g. monthly salary) is supported by setting `type = income`.

Table format:

| status | service                | amount | type    | tag                  | from            | to        | date           | interval | remaining-occurrences |
| ------ | ---------------------- | ------ | ------- | -------------------- | --------------- | --------- | -------------- | -------- | --------------------- |
|        | spotify family plan    | 279    | expense | digital-subscription | Maya Wallet     |           | April 18, 2026 | monthly  | —                     |
|        | youtube premium        | 379    | expense | digital-subscription | Maya My Savings |           | April 18, 2026 | monthly  | —                     |
| ⏸      | custom domain          | 800    | expense | digital-subscription | Maya Wallet     |           | April 18, 2026 | yearly   | —                     |
|        | GFED salary            | 50,000 | income  | monthly-salary       |                 | UnionBank | April 20, 2026 | monthly  | —                     |
|        | Macbook Pro 14" M5 Pro | 2,999  | expense | gadgets              | Maya Wallet     |           | April 5, 2026  | monthly  | 23                    |
| ...    | ...                    | ...    | ...     | ...                  | ...             | ...       | ...            | ...      | ...                   |

The `status` column shows a pause icon (⏸) for paused recurrings, a check icon (✓) for completed installments, and is empty for active ones.

#### Filtering

A lightweight filter bar above the Recurring table:

- **Status** — Active / Paused / Completed. Default shows Active + Paused; Completed is hidden unless toggled on (matches the "hidden by default" rule from Installment completion).
- **Type** — `expense` / `income` / `transfer`.
- **Account** — filter by `from` or `to`.
- **Tag**.
- **Interval**.
- **Search** — free-text search on `service`.

No implicit filtering from elsewhere — the Recurring table is a global list. Unlike the Transactions table, it's not pre-filtered based on the currently selected account on the Accounts page.

#### Firing mechanics

Recurrings fire **server-side** via Supabase pg_cron — the user does not need to be online. Each recurring stores `nextOccurrenceAt` as a `timestamptz` representing an absolute UTC moment equivalent to **midnight in the user's local timezone** on the scheduled date.

An hourly cron job scans for recurrings where `nextOccurrenceAt <= now()` and for each:

1. Creates an auto-generated transaction linked to the recurring via `recurringId` (see [Auto-generated transactions](#auto-generated-transactions-from-recurring) under Transactions). Transaction `date` is the scheduled occurrence date, not today.
2. For installments, decrements `remaining-occurrences` by 1.
3. Advances `nextOccurrenceAt` to the next scheduled moment — computing "midnight in the user's local TZ" at the new date so daylight-saving or month-length differences don't drift the firing time.
4. When an installment's `remaining-occurrences` reaches 0, completion behavior kicks in (see Installment completion, below).

**User timezone.** Stored on the user profile (default `Asia/Manila`). Auto-detected at signup from the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`; editable later via Settings. The system is TZ-aware from day one so that multi-zone support later is a non-event.

**No backfill on creation.** If a recurring is created today with a `first-occurrence-date` in the past, `nextOccurrenceAt` is set to the first **future** occurrence in the interval sequence anchored on that date. Past occurrences are not backfilled as transactions. Users who want to record historical occurrences enter them manually.

**Cron-downtime catchup.** If the cron is delayed or skipped, the next run still fires any recurrings whose `nextOccurrenceAt` is in the past, backdating each transaction's `date` to the original occurrence. Safe against transient outages.

#### Interval semantics

How `nextOccurrenceAt` advances after each firing:

- **Weekly** — same day-of-week every 7 days, anchored to the `first-occurrence-date`.
- **Monthly** — same day-of-month every month. **Clamp to last day of month** when the target day doesn't exist: `Jan 31 → Feb 28 (or 29) → Mar 31 → Apr 30 → …`. A month that shortened the date (Feb) does not shift subsequent months; March returns to 31.
- **Quarterly** — same rule as monthly, stepping 3 months forward.
- **Semi-annual** — same rule as monthly, stepping 6 months forward.
- **Annual** — same rule as monthly, stepping 12 months forward. The only place this matters is Feb 29 on a leap year, which clamps to Feb 28 on non-leap years.

#### New Recurring (single modal)

- `service`: string — required, 1–80 chars. Not unique (two "Spotify" rows are allowed — e.g. one personal, one family).
- `amount`: number — required, must be `> 0`.
- `type`: `expense | income | transfer` — required.
- `tag`: required for `expense` and `income`; optional (nullable) for `transfer`. Same rule as Transactions.
- `from`: source account — required for `expense` and `transfer`; omitted for `income`.
- `to`: destination account — required for `income` and `transfer`; omitted for `expense`.
- `fee`: number — only shown on transfer-type recurrings; optional; must be `> 0` when provided. Paired `transfer-fees` expense transactions are created alongside each firing, same as one-off transfers.
- `interval`: `weekly | monthly | quarterly | semi-annual | annual` — required.
- `firstOccurrenceDate` (displayed as **"Schedule"** in the form): date, required. Acts as both the first firing date (if today/future) and the anchor for the interval pattern (day-of-month or day-of-week). If in the past, the next occurrence is computed forward from today; past occurrences are not backfilled.
- `remaining-occurrences`: number — optional. Leave empty for open-ended subscriptions; set for installments. If set, must be a positive integer (`> 0`). **No upper cap** — legitimate use cases (e.g. 10-year mortgage-style plan at 120 monthly occurrences) exist.

**Validation (cross-field):**

- On `transfer` recurrings, `from` and `to` must be different accounts.
- Credit accounts are allowed on either side of a transfer recurring (same as one-off transfers).

**Pre-fill from context.** Same rules as `New Transaction`:

- **No account selected:** no field pre-filled. `type` defaults to `expense`.
- **Account selected** (via inline filter on Accounts page): that account is pre-filled as `from` (or relocated to `to` if the user switches `type` to `income`).
- **Group selected:** no account pre-fill (ambiguous which group member to pick).

#### Edit

All fields editable after creation. Scope of changes:

- Editing `amount`, `from`, `to`, `type`, or `fee` affects **only future firings**. Past auto-generated transactions are historical records and are not modified.
- Editing `interval` or `firstOccurrenceDate` recomputes `nextOccurrenceAt` based on the new anchor/interval, stepping forward from today. Past transactions remain.
- Editing `service`, `tag`, or `description` is metadata-only and has no effect on balance math or past transactions.
- Editing `remaining-occurrences` resets the installment countdown.

#### Pause and resume

Recurrings can be paused without losing their configuration. Stored as `isPaused` boolean (default `false`).

- Paused recurrings do **not** fire. `nextOccurrenceAt` is left intact but ignored by the cron.
- Pause is toggled via an icon button on the recurring row (or a toggle in the edit modal).
- Paused rows display the pause icon (⏸) in the status column and optionally a dimmed row style. They remain visible in the table so the user doesn't forget they exist.
- When resumed, `nextOccurrenceAt` is recomputed from today forward based on the existing `firstOccurrenceDate` anchor and `interval`. No burst of backfills for the pause period.

#### Installment completion

When an installment's `remaining-occurrences` reaches `0`, the recurring is marked complete: an `isCompleted` boolean flips to `true`, and future cron runs skip it. The completion timestamp is recorded (`completedAt`).

- Completed recurrings display a check icon (✓) in the status column.
- Completed recurrings are **hidden from the main Recurring table by default**. A toggle ("Show completed") in the filter/controls area reveals them.
- Historical auto-generated transactions still link back to the completed recurring via `recurringId`, so users can always trace "when did I finish paying off the MacBook?"
- Completed recurrings can be manually deleted to clean up; deletion does not affect their past transactions (same rule as deleting an active recurring).

### Budget

Per-tag, per-calendar-month, report-only. Monthly is the only granularity in v2.0 — no weekly or annual budgets. Users who want week-level or year-level views drill into the Transactions table with date filters. Two levels:

- **Overall cap** — a single monthly total across all expense transactions.
- **Per-tag allocations** — one cap per tag; actual spend for a tag is computed by summing that month's `expense` transactions carrying that tag. **Special rule for split-linked expenses:** if an expense has `splitId IS NOT NULL`, it contributes only the user's share (`totalAmount − Σ(participant_shares)`), not the full amount. This keeps the Budget true to personal spending — a ₱4,800 group dinner where the user's share is ₱960 contributes ₱960 to the tag's actual, not ₱4,800. See [Splits ↔ Accounts integration](#splits--accounts-integration-auto-ledger) under Debts & Splits.

**Expense-only.** Budget in v2.0 targets `expense` transactions exclusively. Income is not budgeted. Users who want to see income trends look at Overview (monthly trend chart) or filter the Transactions table.

**Unbudgeted tags ("Others").** Users aren't required to allocate every tag. Expenses tagged with a tag that has no allocation for the current month aggregate into a synthetic **"Others"** row at the bottom of the per-tag table:

- Budget column: — (no allocation)
- Actual column: sum of unallocated-tag expenses for the period
- Remaining column: — (N/A)

"Others" still counts toward the **Overall cap** — if a user spends ₱500 on an unallocated tag, that ₱500 contributes to their Overall Actual.

**Strict: sum of per-tag allocations must not exceed Overall.** At save time, `Σ(tag_allocations) ≤ overall_cap` is enforced. If a user tries to save a set of allocations that sum beyond the Overall cap, the save is blocked with an error (e.g. *"Tag allocations total ₱22,000 but Overall is ₱20,000. Increase Overall or reduce a tag."*). Equal is allowed (fully allocated); less-than is allowed (remaining capacity flows to "Others" at the category level).

Budgets don't block or prevent overspending at transaction time — they are purely a reporting view. Overages are shown in red on the Budget page. Essentially a port of v1's model (`budget_config` + `budget_allocation` tables).

**No rollover in v2.0.** Each month is a fresh slate. Leftover allocation (or overage) in a period does not carry to the next. Keeps the model simple and easy to explain; per-tag rollover toggles can be revisited in v2.1 if real use reveals the need.

**Historical view.** The Budget page has a **month-picker** at the top. Users can navigate to any past (or future) month and see its Budget / Actual / Remaining. Allocations are **snapshotted per-month**: the data model includes a `month` column on both the overall cap and the per-tag allocation rows (`YYYY-MM` granularity). Editing April's budget does not change what March's page shows; March stays as what the user set at that time.

When a user opens a month that has no allocations yet, the form starts empty. A small **"Copy from previous month"** action pre-fills the form with the most recent prior month's allocations so setup is a one-click move forward each cycle.

#### Layout

**Hero card — Overall.** Top of the page. Big number + horizontal progress bar showing Actual vs Overall budget.

```
┌─────────────────────────────────────────────┐
│  Overall                                    │
│  ₱17,683 of ₱20,391   ·   ₱2,708 remaining  │
│  [████████████████████░░░░░]   87%          │
└─────────────────────────────────────────────┘
```

**Per-tag allocation table.** Below the hero. One row per allocated tag, plus a synthetic "Others" row at the bottom for unallocated expenses.

| Tag                   | Budget    | Actual | Remaining  | Progress        |
| --------------------- | --------- | ------ | ---------- | --------------- |
| education             | 9,500     | 9,500  | 0          | [████████] 100% |
| foods                 | 2,708.60  | 500    | 2,208.60   | [█░░░░░░░]  18% |
| pets                  | 2,500     | 2,500  | 0          | [████████] 100% |
| digital-subscriptions | 658       | 658    | 0          | [████████] 100% |
| allowance             | 5,000     | 4,500  | 500        | [███████░]  90% |
| transfer-fees         | 25        | 25     | 0          | [████████] 100% |
| Others (unbudgeted)   | —         | 0      | —          | —               |

The table header row shows the running total above: *"Per-tag allocation — Total: ₱20,391"*.

**Color coding (hero and per-tag bars):**
- **Green** — under 80% of budget
- **Orange** — 80–100%
- **Red** — over 100%

**Drill-in.** Clicking a tag row (or the hero card) opens the list of that tag's `expense` transactions for the selected month. "Others" drills into all unallocated-tag expenses.

**Overage indicator.** When any per-tag actual exceeds its budget for the current month (including the Overall cap), a small red badge appears on the Budget nav link in the sidebar. Tapping the badge takes the user to the Budget page where the specific over-budget rows are visibly red. No toasts, push notifications, or emails in v2.0 — the in-page coloring + nav badge combination is enough for awareness without being intrusive.

### Debts & Splits

Ports v1's Splitwise-style model (`split_event`, `split_participant`, `debt`) with one meaningful upgrade: participants are normalized into a **Person** entity (per-user contacts list) rather than plain name strings. Solo-use single-user; no multi-user auth or invitation flow — a Person is just a named contact in your list.

Balance summary strip, pinned above the tables:

```
  You're owed  ₱X          You owe  ₱Y
```

Computed client-side from all unsettled `debt` rows.

#### Person entity (contacts list)

Per-user. Stored as a `person` table with just `{ id, name, createdAt }` for v2.0 (no phone / email / avatar — kept minimal).

- **Where it's referenced:** `split_participant.personId` (FK) and `debt.personId` (FK).
- **Creation:** participants are picked from the contacts list via a typeahead in the New Split / New Debt forms. A "+ New person" option at the bottom of the picker creates a new `person` row inline without leaving the form.
- **Rename:** a single-row update on the `person` entity; transparent to every consumer (same pattern as tag rename). Past splits and debts immediately show the new name everywhere.
- **Delete:** only allowed when the person has no linked debts or participants. If they do, the user must first delete or reassign those records. Hard constraint — prevents orphaning.
- **Management:** a "Contacts" page in Settings lists all persons with inline rename/delete (same pattern as Tag management).
- **Debts table grouping:** pinned rows by person use `personId`; the name shown is always the current `person.name`.

#### Debts table (grouped by person, pinned-row style)

| Person | Direction | Amount | Settled | Remaining | Tag | Date | Linked Split | Description |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Group rows pin per-person totals (e.g. `**Alice** — ₱4,500 net owed to you`). Row action: `[Settle]` button opens `SettleModal`; ✓ Settled badge once fully paid.

#### Splits table

| Description | Total | Your Share | Paid From | Tag | Date | Method | Participants | Progress |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

`Method` is one of `equal | exact | percentage | shares`. `Participants` shows compact list (`Alice, Bob, +2`). `Progress` shows `N/M settled`. Row click **expands the row inline** (see below); no separate route.

#### Split row expansion (inline detail, no separate route)

Clicking a split row expands it in place. One split is expanded at a time — clicking another row collapses the first. Selection is reflected as a query param (`?split=<id>`) so expanded state is bookmarkable and shareable.

The expanded block contains:

- **Actions** top-right: `[ Edit ]` and `[ Delete ]` buttons.
- **Participants list** — one row per participant:
  - Name
  - Share amount
  - Status: `[ Settle ▸ ]` button (pending) · partial-paid indicator + `[ Settle ▸ ]` (partially settled) · ✓ Settled badge (fully paid).
- **Your share** (read-only; you don't settle with yourself).
- **Summary footer** — `{count}-way split · {method} · ₱{pending} pending · ₱{settled} settled`.

Header info (description, total, date, tag, paid-from) is **not duplicated** inside the expansion — the table row above already shows all of that.

**Action behaviors:**

- `[ Settle ▸ ]` on a participant → opens `SettleModal` with the debt pre-populated; partial amounts allowed.
- `[ Edit ]` → opens the `New Split` modal pre-filled with current values; partial settlements on existing participants are preserved on save.
- `[ Delete ]` → confirm dialog → removes the split event + all linked participants + all linked debts. See [Splits ↔ Accounts integration → Deletion cascades](#splits--accounts-integration-auto-ledger) for how this interacts with auto-created transactions (summary: the auto-expense from `paidFrom` is deleted, but any debt-settlement income transactions are preserved and retagged `debt-settlement-orphan`).

Reference for the underlying model: `docs/superpowers/specs/2026-04-14-splitwise-design.md`.

#### New Split / New Debt (from FAB)

- `New Split`: description, total amount, payer account, **tag (required)**, date, method (`equal | exact | percentage | shares`), participants (picked from contacts, created inline) with per-method share inputs.
- `New Debt`: counter-party (picked from contacts or created inline), direction (`loaned | owed`), amount, tag (required for split-derived debts via inheritance; optional on standalone debts), date, description, **optional "Paid from / Paid to" account** (see integration rules below — blank is allowed for IOU-style tracking where no tracked account was involved).

#### Behavior rules

**Partial settlements.** Supported on any debt (split-linked or standalone). A debt tracks `settledAmount` cumulatively; each SettleModal submission adds to it, up to `amount`. Multiple partial settlements are allowed; each creates its own auto-transaction (one settlement event = one transaction).

**Tags on debts.**
- Split-derived debts inherit their tag from the parent split. Not directly editable on the debt — change the split's tag, and all linked debts pick it up.
- Standalone debts set their own tag (optional).
- Settlement transactions are auto-tagged `debt-settlement` (system tag, excluded from budgets).

**Editing a split with partial settlements** (ports v1's rule):
- Existing participants' `settledAmount` is preserved on save. Only `shareAmount` updates.
- Removing a participant on edit deletes that `split_participant` row and its linked `debt` — even if partially settled. Any settlement transactions for that participant stay in the Transactions table, retagged `debt-settlement-orphan`.
- Adding a participant on edit inserts new `split_participant` + `debt` rows; `settledAmount` starts at 0.

**Rounding math (Equal split).** When the total doesn't divide evenly among participants (e.g. ₱100 / 3 = ₱33.33 each, with ₱0.01 remainder), the **user-the-payer absorbs the remainder**. "Your share" is the computed slice plus the remainder cent. Keeps the total exact and doesn't saddle participants with awkward odd amounts.

#### Filtering

**Debts table** filter bar: person, direction (`loaned | owed`), settled/unsettled, tag, date range. Plus a search box (matches on person name or description).

**Splits table** filter bar: tag, date range, method, progress (`all | not settled | partially settled | fully settled`). Plus a search box (matches on description or participant name).

#### Unsettled-debts nav indicator

A small red dot on the "Debts & Splits" nav link when there are **unsettled `loaned` debts** (people owe you). Debts owed by you don't trigger the indicator — those are within your own control and don't need a nudge. Tap the badge → lands on the Debts table pre-filtered to unsettled loaned debts.

#### Splits ↔ Accounts integration (auto-ledger)

Splits and debts keep the ledger honest by auto-creating transactions tied to the relevant account, so the user doesn't have to double-enter.

**On split creation:**

1. One `expense` transaction is auto-created for the **full total** from `paidFrom`, tagged with the split's tag, linked to the split via `splitId` FK.
2. `split_event`, `split_participant`, and `debt` rows are created as described above.
3. Maya Wallet (or whatever `paidFrom` is) naturally decreases by the full total via the normal transaction-balance pipeline.

**On debt settlement (from SettleModal):**

- For a **loaned** debt (they owe you): user picks "Paid to" account. An `income` transaction is auto-created on that account for the settled amount, tagged with a system tag `debt-settlement`, linked to the debt via `debtId` FK. The account balance recovers.
- For an **owed** debt (you owe them): user picks "Paid from" account. An `expense` transaction is auto-created on that account for the settled amount, tagged `debt-settlement`, linked via `debtId`. The account balance decreases.
- Partial settlements create one auto-transaction per settlement event (so a debt paid in 3 chunks has 3 linked transactions).

**Standalone debts (not tied to a split):**

The "Paid from / Paid to" field is **optional** on the New Debt form:

- **If provided** → at creation, auto-create the corresponding transaction (expense for `loaned`, income for `owed`) on that account, tagged with the debt's tag, linked via `debtId`. Normal balance math applies.
- **If left blank** → data-only debt row. No transaction created at creation or settlement. Useful for IOU-style tracking where the money didn't flow through a tracked account.

Once created, a standalone debt's settlement follows the same pattern as a split debt: SettleModal asks for a "Paid to / Paid from" account if the debt isn't already paired with one; blank stays blank.

**Budget math rule for split-linked expenses.** When summing "Actual" for a tag in Budget:

- Non-split-linked expenses count for their **full amount**.
- **Split-linked expenses** (`splitId IS NOT NULL`) count only the **user's share** — computed as `totalAmount − Σ(participant_shares)` — not the full amount.

This keeps the Budget showing true personal spending: Mama Lou's at ₱4,800 total contributes ₱960 to the `dates` tag actual, not ₱4,800.

`debt-settlement`-tagged income transactions are excluded from Budget (budget is expense-only anyway, so this is automatic).

**Deletion cascades:**

- Deleting a split → deletes the split event, linked participants, linked debts, **and** the auto-created expense transaction. Any settlement transactions on debts are preserved as income rows (retagged `debt-settlement-orphan` to reflect the parent split is gone).
- Deleting a standalone debt → deletes the debt row and any linked auto-created transaction.
- Deleting an auto-created transaction directly (from the Transactions table) → blocks with an error: *"This transaction is tied to a split/debt. Delete the split/debt itself to remove it."* Avoids orphaning.

> **Note: this differs from the recurring-linked rule.** A transaction auto-generated by a recurring *can* be deleted individually (see [Auto-generated transactions](#auto-generated-transactions-from-recurring) under Transactions) — the recurring survives and fires again next cycle, so the linkage is loose. A split-linked transaction, by contrast, is structurally inseparable from its split: without it, the split's "paid from" balance math is wrong. So splits require deleting the parent entity; recurrings don't.

### Settings

#### Profile

- **Avatar** — default generated from the display name (DaisyUI avatar with initials, or generic user icon fallback). No upload, no URL storage in v2.0.
- **Display name** — editable text field, 1–50 chars. No uniqueness constraint (personal app).
- **Email** — read-only, shows the Supabase auth email. Changes to email go through Supabase's email-change flow (re-verification required); v2.0 surfaces this as a link rather than an in-app form.
- **Change password** — link that triggers Supabase's password-reset email flow. No in-app password form.
- **Timezone** — searchable combobox of IANA timezone identifiers (typing `manila` or `+08` both surface `Asia/Manila (UTC+08:00)`). Default auto-detected at signup from `Intl.DateTimeFormat().resolvedOptions().timeZone`; editable here. Changing it affects where "midnight" lands for recurring firings and which calendar month a near-midnight transaction falls under for Budget. **No retroactive recomputation** — past transactions stay dated as they were stored. Helper text: *"Used to fire recurring transactions at midnight local time. Auto-detected at signup; change if it's wrong."*
- **Sign out** — signs out of the current device.
- **Delete account** — opens a confirmation dialog that requires typing the user's email (or display name) before the Delete button activates. On confirm: **immediate hard-delete** of the auth record and all user-owned rows (accounts, transactions, recurrings, budget config/allocations, debts, splits, participants, persons, tags). No grace period, no soft-delete. Users who want a backup are expected to export first.
- **Two-factor auth** — skipped for v2.0. Users who need it can enable it at the Supabase level directly.

#### Appearance

- **Theme** — stored as a string on the user profile. Applied by setting the root `data-theme` attribute that DaisyUI reads.
- **Curated list for v2.0:** `system` (default — follows OS), `light`, `dark`, `corporate`, `business`, `emerald`, `cupcake`, `lemonade`, `winter`, `night`, `dim`. All DaisyUI-native.
- **Picker UI:** simple dropdown with a small preview swatch (primary + secondary color chips) next to each theme name. No live preview of the whole UI — just swap on select.
- Semantic colors (red = over-budget, orange = near cap, green = under) map to DaisyUI's `error` / `warning` / `success` tokens, which every theme defines — so the color semantics we rely on work across all choices.
- If 11 options proves too narrow in real use, adding more DaisyUI themes is a single-line config change per theme.

#### Tag management

Add / rename / delete user tags. Defaults are seeded on signup; users can freely diverge from the seed list.

#### Contacts

Add / rename / delete persons used in splits and debts. Delete blocked when the person has linked records.

#### Groups

Add / rename / delete account groups. Delete blocked when the group has member accounts (user must first reassign or ungroup them). Groups are created inline from the group picker on the New Account / Edit Account form; this section is purely for management.

#### Data export

Two formats available:

- **Full JSON** — single file, every entity you own. Intended as a readable backup. Shape:

  ```
  {
    exportedAt: ISO-8601 with TZ offset,
    user: { id, displayName, email, timezone, theme },
    accounts, groups, tags, persons,
    transactions, recurrings,
    budgets: { configs, allocations },
    debts, splitEvents, splitParticipants
  }
  ```

  Timestamps are ISO-8601 with TZ offset. Amounts are integer centavos (no floats).

- **CSV per entity** — pick any entity (accounts, transactions, recurrings, debts, splits, etc.) and download a flat CSV of those rows. Useful for pasting into Excel / Sheets for ad-hoc analysis.

**Scope:** all historical data. Archived accounts, completed installments, settled debts — everything included.

**Delivery:** direct browser download. One button per format.

**What it's *not* in v2.0:** not a round-trip format. There's no "import from JSON" flow — data export is a safety-valve backup, not a migration path. Import lives alongside bulk CSV import in v2.1.

#### Help & About

Small footer section at the bottom of Settings.

- **Version** — shown as text (e.g. `kwartrack v2.0.3`). Sourced from the app's build metadata so it's always current.
- **What's new** — link to the changelog (external page or modal with the latest release notes).
- **Feedback** — link (mailto or external issue tracker) so users have a clear path to report bugs / suggest features.

### Floating Action Button (FAB)

Global FAB for quick creation.

**Position & layout:**
- Fixed to viewport, **bottom-right** with ~16px margin from both edges.
- Z-index above page content, **below modals** — when any modal is open, the FAB is hidden to avoid stacking weirdness.

**Expansion style:**
- Tapping the FAB reveals a **vertical stack** of options above the button (labels on the left, icons on the right).
- Button icon rotates from `+` to `×` as an affordance that it's now a close control.
- Background content is dimmed via a light overlay to prevent click-throughs.
- Options animate in top-to-bottom (staggered fade/slide, ~200ms total).
- Dismiss via clicking `×`, clicking outside the menu, or pressing `Esc`.

**Options (frequency-based order, stack top → bottom; most-used closest to thumb):**

```
  [wallet]        New Account        ← rarely (after initial setup)
  [repeat]        New Recurring      ← uncommon (setup once per sub)
  [hand-coins]    New Debt           ← occasional
  [users]         New Split          ← occasional, more common than Debt
  [arrow-right-left]  New Transaction ← most common  ← closest to FAB
```

Icons sourced from Lucide (consistent icon library across the app).

Rationale: since the FAB sits at the bottom-right and the stack expands upward, the item nearest the FAB is the easiest for the thumb to reach. The most-used action gets that position; rarest actions go furthest away. Order is **fixed** across all pages — muscle memory wins for a 5-item menu.

**Where FAB is hidden:**
- Sign-in / sign-up pages (no authenticated context to create in).
- Settings page (the user is configuring, not creating transactional data).

**Where FAB is shown:** Overview, Accounts (+ Transactions), Recurring, Budget, Debts & Splits, and any inline-expanded views within them.

**Keyboard shortcuts:** deferred to v2.x. `N` → open menu; letter keys for each option (T/S/D/R/A) to pick. Not in v2.0.

### Onboarding / first-run

A newly signed-up user sees empty states everywhere. Each empty state:
- Names the concept in one sentence.
- Offers the first action via the FAB (e.g. the Accounts page shows "No accounts yet — tap + to create your first account").

Detailed onboarding UX (tours, sample data) is deferred to a later pass.

#### Sign-up flow

Minimal — three fields, no welcome screen.

1. **Sign-up form** (Supabase-backed): `email`, `password`, `display name`. Nothing else asked upfront.
2. **On submit** — Supabase creates the auth record; the app creates the user profile with `displayName`, `email`, auto-detected `timezone` (via `Intl.DateTimeFormat().resolvedOptions().timeZone`), and `theme = 'system'`. Seeds default tags. Creates an empty `budget_config` row (overall cap `0`).
3. **Email verification** — if Supabase has it enabled, standard flow (click link in email → return to app).
4. **First landing** — Overview page, rendering its empty-state welcome card (*"Welcome to Kwartrack 👋 Create your first account"*). No dedicated welcome screen between sign-up and Overview; the welcome card carries that role.

#### Empty-state copy (per surface)

All empty states are short, second-person, and name the next step.

| Surface | When shown | Copy |
| --- | --- | --- |
| Overview | No accounts yet | Welcome card (see Overview → Empty state). |
| Accounts table | No accounts yet | *"No accounts yet. Tap the `+` button to create your first one."* |
| Transactions table (main) | No transactions yet | *"No transactions yet. Create one from the `+` button, or start by creating an account."* (If no accounts either: swap copy to *"Start by creating an account first."*) |
| Transactions table (account-filtered) | This account has no transactions | *"No transactions in this account yet."* |
| Recurring | No recurrings yet | *"No recurring transactions yet. Add subscriptions, installments, or salary via the `+` button."* |
| Budget | No allocations for this month | *"No budget set for this month. Start by setting an Overall cap, then allocate per tag."* with a `[ + Set Budget ]` button that opens inline edit. |
| Debts & Splits | No debts, no splits | *"No debts or splits tracked yet. Split a bill with friends or record an IOU via the `+` button."* |
| Upcoming (Overview) | Nothing upcoming | *"You're all caught up 🎉 — no recurring due, no old debts, no budget overages."* |
| Settings → Contacts | No contacts yet | *"No contacts yet. Add people when you create your first split or debt."* |
| Settings → Groups | No groups yet | *"No groups yet. Create one when assigning accounts."* |

#### Default seeds on signup

What a fresh user starts with:

- **Tags** — full default list seeded (all expense + income + transfer categories from the Tags section). Editable.
- **User profile** — `displayName` (from form), `email`, auto-detected `timezone`, `theme = 'system'`.
- **Budget config** — empty row (overall cap `0`). User sets it when they first visit Budget.
- **Contacts** — empty. Persons created inline when the user adds splits/debts.
- **Groups** — empty. Groups created inline when the user assigns accounts.
- **Accounts, transactions, recurrings, debts, splits** — all empty.

## Tags

Tags are first-class per-user data, editable from Settings → Tag Management. A fresh account is seeded with the defaults below; the user can add, rename, or delete at will.

**Tag references are FK-based, not string-based.** Transactions, recurrings, budget allocations, and splits all reference tags by ID. Renaming a tag (e.g. `foods` → `groceries`) is a single-row update on the tag entity and is transparent to every consumer — no cascade, no historical-data migration needed. Past transactions tagged `foods` immediately show `groceries` everywhere they appear.

**System tags.** Three tags are auto-applied by the app rather than picked by the user:

| Tag | Auto-applied when |
| --- | --- |
| `transfer-fees` | A transfer has a non-zero `fee` — the paired fee transaction is tagged this. |
| `debt-settlement` | A debt is settled (split-linked or standalone) — the resulting income/expense transaction is tagged this. |
| `debt-settlement-orphan` | A settlement transaction survives after its parent split is deleted (see Debts & Splits deletion cascades). |

System tags carry an `isSystem: true` flag on the tag entity and behave differently from user tags:

- **Hidden from the tag picker** in New Transaction / New Recurring / Budget forms — the user cannot manually apply them.
- **Visible in Settings → Tag Management** but shown with a lock icon; **no rename or delete action**.
- **Visible in Budget reports** — e.g. *"how much have I paid in transfer fees this month?"* is a legitimate query and the tag carries that data.
- **Seeded on signup** alongside user-facing defaults.

**Type scoping.** Every tag carries a `type` field (`expense | income | transfer`). Tag pickers on New Transaction / New Recurring filter to the current transaction type — `monthly-salary` only appears when creating an income transaction; `foods` only for expenses. New-tag creation forces the user to pick a type up front.

Why: keeps reports and Budget math unambiguous. Budget sums expense-tagged transactions; income reports sum income-tagged ones. A tag that could span both (e.g. `gifts` — you give and receive them) is represented as **two distinct tag rows** (one expense, one income), both named `gifts`. The defaults list reflects this — `gifts` appears in both sections.

**Transfer-type transactions and tagging.** Tags are optional on transfers; the default tag list has no transfer-scoped entries (transfers between your own accounts aren't really a spending category). If a user wants to tag a transfer anyway, the picker shows **all user tags regardless of scope** (the `type` filter is relaxed for transfer transactions). Users can also create new transfer-scoped tags from the picker if they want categorized transfers (e.g. `internal-savings-move`).

System tags (`transfer-fees`, `debt-settlement`, `debt-settlement-orphan`) are scoped to `expense` since they're always applied to expense transactions, except `debt-settlement` which applies to the type that matches the settlement direction (income on loaned-debt settlements, expense on owed-debt settlements) — technically both, so it has `type = 'any'` internally.

**Deletion.** Deleting a tag is **blocked when it's in use** — if any transaction, recurring, budget allocation, split, or debt references the tag, the delete action is disabled with an error (*"This tag is used by N transactions. Retag them before deleting."*). Hard constraint, no soft-delete, no cascade-null. Matches the pattern for Person, Group, and Account deletion. System tags can't be deleted at all (see System tags above).

**Ordering.** Tags sort alphabetically within their type bucket. User-configurable ordering (drag-to-reorder) is deferred to v2.x.

**Deferred to v2.x:**

- **Emoji / color per tag** — visual richness in the tag picker and Budget rows. Low priority for v2.0.
- **Custom tag ordering** — drag-to-reorder in Settings → Tag Management.

### Default tags

#### Expense
- foods
- grocery
- transportation
- online-shopping
- gadgets
- bills
- pets
- personal-care
- health
- digital-subscriptions
- entertainment
- clothing
- education
- travel
- housing
- insurance
- gifts
- dates
- interest-paid

#### Income
- monthly-salary
- freelance
- interest-earned
- bonus
- gifts

#### Transfer
- *(transfers don't require a tag — transfer transactions may omit the tag field)*

#### System (auto-applied, not in user picker)

- `transfer-fees` — scope `expense`. Applied to paired fee transactions on transfers with a non-zero fee.
- `debt-settlement` — scope `any` (expense on owed-debt settlements; income on loaned-debt settlements). Applied automatically on SettleModal submit.
- `debt-settlement-orphan` — scope `any`. Applied when a settlement transaction survives after its parent split is deleted.

See [System tags](#system-tags) above for behavior rules.
