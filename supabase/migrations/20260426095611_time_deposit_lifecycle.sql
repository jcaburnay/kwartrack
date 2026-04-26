-- Slice 8: time-deposit lifecycle.
-- Brings TD interest accrual + maturity handling online by:
--   1. Linking each TD account to a recurring `income` row that posts net
--      interest (after 20% PH withholding) at the chosen cadence — except
--      `at-maturity`, which has no recurring (the daily cron posts a single
--      lump-sum income transaction when maturity passes).
--   2. AFTER triggers on `account` keep the linked recurring in lockstep
--      with rate / interval / name edits and create-or-delete it as the
--      interval crosses the at-maturity boundary.
--   3. A daily pg_cron job flips `is_matured` on TDs whose maturity_date
--      has passed and either pauses the linked recurring (periodic intervals)
--      or posts the lump-sum income (`at-maturity` interval).
--
-- Withholding-tax math is ported verbatim from v1's
-- `computeMonthlyNetInterestCentavos`:
--     net = principal × bps × 80 / (10000 × postings_per_year × 100)
-- All integer arithmetic — no float drift over long-running deposits.

-- 1. Linkage column ---------------------------------------------------------

alter table public.account
  add column interest_recurring_id uuid
    references public.recurring (id) on delete set null;

create index account_interest_recurring_idx
  on public.account (interest_recurring_id)
  where interest_recurring_id is not null;

-- 2. Math helpers -----------------------------------------------------------

-- Periodic posting count for a given posting_interval. Returns null for
-- 'at-maturity' (no periodic posting).
create or replace function public.td_postings_per_year(p_interval public.posting_interval)
returns int
language sql
immutable
as $$
  select case p_interval
    when 'monthly'     then 12
    when 'quarterly'   then 4
    when 'semi-annual' then 2
    when 'annual'      then 1
    else null
  end;
$$;

-- Map account.posting_interval → recurring.recurring_interval. Different
-- enums historically (dash vs underscore for semi-annual). Returns null
-- for 'at-maturity'.
create or replace function public.td_recurring_interval(p_interval public.posting_interval)
returns public.recurring_interval
language sql
immutable
as $$
  select case p_interval
    when 'monthly'     then 'monthly'::public.recurring_interval
    when 'quarterly'   then 'quarterly'::public.recurring_interval
    when 'semi-annual' then 'semi_annual'::public.recurring_interval
    when 'annual'      then 'annual'::public.recurring_interval
    else null
  end;
$$;

-- Per-period net interest (after 20% withholding). Integer-only.
create or replace function public.td_periodic_net_interest_centavos(
  p_principal_centavos bigint,
  p_rate_bps int,
  p_postings_per_year int
)
returns bigint
language sql
immutable
as $$
  select (p_principal_centavos * p_rate_bps * 80)
       / (10000::bigint * p_postings_per_year * 100);
$$;

-- Lump-sum at-maturity net interest (after 20% withholding) using simple
-- interest from anchor date through maturity date. Integer-only:
--   net = principal × bps × days × 80 / (10000 × 365 × 100)
create or replace function public.td_at_maturity_net_interest_centavos(
  p_principal_centavos bigint,
  p_rate_bps int,
  p_anchor_date date,
  p_maturity_date date
)
returns bigint
language sql
immutable
as $$
  select greatest(0,
    (p_principal_centavos * p_rate_bps * (p_maturity_date - p_anchor_date)::bigint * 80)
    / (10000::bigint * 365 * 100)
  );
$$;

-- 3. Helper: insert the linked recurring for a TD account ------------------

-- Encapsulates the "create the interest-posting recurring + back-link it on
-- the account" dance so the INSERT and UPDATE triggers can share it.
-- Returns the new recurring id.
create or replace function public.td_create_interest_recurring(p_account public.account)
returns uuid
language plpgsql
as $$
declare
  v_tag_id uuid;
  v_amount bigint;
  v_pp_year int;
  v_interval public.recurring_interval;
  v_anchor date;
  v_tz text;
  v_new_id uuid;
begin
  v_pp_year := public.td_postings_per_year(p_account.interest_posting_interval);
  v_interval := public.td_recurring_interval(p_account.interest_posting_interval);
  if v_pp_year is null or v_interval is null then
    -- at-maturity: no recurring.
    return null;
  end if;

  select id into v_tag_id
    from public.tag
    where user_id = p_account.user_id and name = 'interest-earned'
    limit 1;
  if v_tag_id is null then
    raise exception 'td_create_interest_recurring: interest-earned tag missing for user %', p_account.user_id;
  end if;

  v_amount := public.td_periodic_net_interest_centavos(
    p_account.principal_centavos, p_account.interest_rate_bps, v_pp_year
  );
  if v_amount <= 0 then
    -- Rounded to zero (tiny principal × tiny rate). Skip recurring; user can
    -- bump rate or use at-maturity to capture the cents.
    return null;
  end if;

  select coalesce(timezone, 'Asia/Manila') into v_tz
    from public.user_profile where id = p_account.user_id;
  v_anchor := (p_account.created_at at time zone coalesce(v_tz, 'Asia/Manila'))::date;

  -- next_occurrence_at is materialized by recurring_set_next_at trigger.
  insert into public.recurring
    (user_id, service, amount_centavos, type, tag_id,
     to_account_id, interval, first_occurrence_date, next_occurrence_at)
  values
    (p_account.user_id, p_account.name || ' — Interest', v_amount, 'income', v_tag_id,
     p_account.id, v_interval, v_anchor, now())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- 4. AFTER INSERT trigger: spin up the linked recurring --------------------

create or replace function public.td_account_after_insert()
returns trigger
language plpgsql
as $$
declare
  v_rec_id uuid;
begin
  if new.type <> 'time-deposit' then return new; end if;
  v_rec_id := public.td_create_interest_recurring(new);
  if v_rec_id is not null then
    update public.account set interest_recurring_id = v_rec_id where id = new.id;
  end if;
  return new;
end;
$$;

create trigger td_account_after_insert_trg
  after insert on public.account
  for each row execute function public.td_account_after_insert();

-- 5. AFTER UPDATE trigger: keep the linked recurring in sync ---------------

create or replace function public.td_account_after_update()
returns trigger
language plpgsql
as $$
declare
  v_pp_year int;
  v_new_amount bigint;
  v_new_interval public.recurring_interval;
  v_rec_id uuid;
begin
  if new.type <> 'time-deposit' then return new; end if;
  -- Once matured the cron has paused/resolved the recurring; further edits
  -- shouldn't resurrect it.
  if new.is_matured then return new; end if;

  -- Name change → keep service label in sync.
  if old.name is distinct from new.name and new.interest_recurring_id is not null then
    update public.recurring
       set service = new.name || ' — Interest'
     where id = new.interest_recurring_id;
  end if;

  -- Interval transitions: at-maturity ↔ periodic.
  if old.interest_posting_interval is distinct from new.interest_posting_interval then
    if new.interest_posting_interval = 'at-maturity' then
      -- Drop linked recurring; FK SET NULL clears interest_recurring_id.
      if new.interest_recurring_id is not null then
        delete from public.recurring where id = new.interest_recurring_id;
      end if;
      return new;
    end if;

    if old.interest_posting_interval = 'at-maturity' or new.interest_recurring_id is null then
      -- Came from at-maturity (no existing recurring) or somehow lost the link
      -- → create fresh.
      v_rec_id := public.td_create_interest_recurring(new);
      if v_rec_id is not null then
        update public.account set interest_recurring_id = v_rec_id where id = new.id;
      end if;
      return new;
    end if;

    -- Both old and new are periodic → just retune the existing recurring.
    v_new_interval := public.td_recurring_interval(new.interest_posting_interval);
    v_pp_year := public.td_postings_per_year(new.interest_posting_interval);
    v_new_amount := public.td_periodic_net_interest_centavos(
      new.principal_centavos, new.interest_rate_bps, v_pp_year
    );
    update public.recurring
       set interval = v_new_interval,
           amount_centavos = v_new_amount
     where id = new.interest_recurring_id;
    return new;
  end if;

  -- Rate change with stable periodic interval → recompute the recurring's
  -- amount only.
  if old.interest_rate_bps is distinct from new.interest_rate_bps
     and new.interest_recurring_id is not null then
    v_pp_year := public.td_postings_per_year(new.interest_posting_interval);
    v_new_amount := public.td_periodic_net_interest_centavos(
      new.principal_centavos, new.interest_rate_bps, v_pp_year
    );
    update public.recurring
       set amount_centavos = v_new_amount
     where id = new.interest_recurring_id;
  end if;

  return new;
end;
$$;

create trigger td_account_after_update_trg
  after update on public.account
  for each row execute function public.td_account_after_update();

-- 6. Daily maturity check --------------------------------------------------

-- Posts at-maturity lump-sum income (when applicable) and pauses the linked
-- recurring (when periodic), then flips is_matured.
create or replace function public.td_check_maturity_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_tz text;
  v_local_today date;
  v_anchor date;
  v_amount bigint;
  v_tag_id uuid;
  v_count int := 0;
begin
  for r in
    select * from public.account
     where type = 'time-deposit'
       and is_matured = false
     for update skip locked
  loop
    select coalesce(timezone, 'Asia/Manila') into v_tz
      from public.user_profile where id = r.user_id;
    v_local_today := (now() at time zone v_tz)::date;
    if r.maturity_date > v_local_today then
      continue;
    end if;

    if r.interest_posting_interval = 'at-maturity' then
      v_anchor := (r.created_at at time zone v_tz)::date;
      v_amount := public.td_at_maturity_net_interest_centavos(
        r.principal_centavos, r.interest_rate_bps, v_anchor, r.maturity_date
      );
      if v_amount > 0 then
        select id into v_tag_id from public.tag
          where user_id = r.user_id and name = 'interest-earned' limit 1;
        if v_tag_id is null then
          raise exception 'td_check_maturity_due: interest-earned tag missing for user %', r.user_id;
        end if;
        insert into public.transaction
          (user_id, amount_centavos, type, tag_id, to_account_id, description, date)
        values
          (r.user_id, v_amount, 'income', v_tag_id, r.id, 'At-maturity interest', r.maturity_date);
      end if;
    elsif r.interest_recurring_id is not null then
      -- Delete (rather than pause) so the user can later hard-delete the
      -- account if they want — recurring.to_account_id ON DELETE RESTRICT
      -- otherwise turns the account into a tombstone. Past interest
      -- transactions keep their history because transaction.recurring_id
      -- is ON DELETE SET NULL.
      delete from public.recurring where id = r.interest_recurring_id;
    end if;

    update public.account set is_matured = true where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

select cron.schedule(
  'td-check-maturity-daily',
  '0 2 * * *',
  $cron$ select public.td_check_maturity_due(); $cron$
);
