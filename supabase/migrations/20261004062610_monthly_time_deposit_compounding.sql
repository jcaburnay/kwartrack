-- Monthly TDs accrue on ledger balances (including credited net interest),
-- ACT/365, with separately rounded gross interest and 20% withholding.
-- Other posting intervals retain their existing behavior.
create table public.td_monthly_interest_state (
  account_id uuid primary key references public.account(id) on delete cascade,
  -- Provenance may exist before funding; initialize the cursor on processing.
  accrued_through date,
  recurring_id uuid references public.recurring(id) on delete set null,
  is_completed boolean not null default false,
  is_paused boolean not null default false,
  archive_owned_pause boolean not null default false,
  remaining_occurrences int check (remaining_occurrences is null or remaining_occurrences >= 0),
  tag_id uuid references public.tag(id) on delete set null
);
alter table public.td_monthly_interest_state enable row level security;
create policy td_monthly_interest_state_select_own
  on public.td_monthly_interest_state for select
  using (exists (select 1 from public.account a
    where a.id = account_id and a.user_id = auth.uid()));
-- Only cron/service-role may change the processed-period cursor.
revoke all on public.td_monthly_interest_state from anon, authenticated;
grant select on public.td_monthly_interest_state to authenticated;
grant all on public.td_monthly_interest_state to service_role;

-- Stable references survive user-visible tag renames and missing back-links.
create or replace function public.td_interest_tag_id(p_account public.account)
returns uuid language sql stable set search_path = public as $$
  select coalesce(
    (select r.tag_id from public.recurring r join public.tag t on t.id = r.tag_id
      where r.id = p_account.interest_recurring_id and r.user_id = p_account.user_id
        and t.user_id = p_account.user_id and t.type = 'income'),
    (select tag_id from public.td_monthly_interest_state where account_id = p_account.id),
    (select r.tag_id from public.td_monthly_interest_state st
      join public.recurring r on r.id = st.recurring_id
      where st.account_id = p_account.id and r.user_id = p_account.user_id
        and r.to_account_id = p_account.id and r.type = 'income'),
    (select id from public.tag where user_id = p_account.user_id
      and name = 'interest-earned' and type = 'income')
  );
$$;

create or replace function public.td_monthly_period_start(p_account public.account)
returns date language sql stable set search_path = public as $$
  select coalesce(
    -- Once created, the protected cursor is authoritative. Editable ledger
    -- dates must never silently mark unprocessed days as credited.
    (select accrued_through from public.td_monthly_interest_state
      where account_id = p_account.id),
    case when p_account.initial_balance_centavos = 0 then
      (select min(t.date) from public.transaction t
        where t.to_account_id = p_account.id and t.type in ('income', 'transfer'))
    end,
    (p_account.created_at at time zone coalesce(
      (select timezone from public.user_profile where id = p_account.user_id),
      'Asia/Manila'))::date
  );
$$;

-- Sum balance-centavo-days without rounding each day's accrual. Transaction
-- dates are end-of-day dates; period bounds are [start, end). This reconstructs
-- historical balances rather than applying today's balance to a past month.
create or replace function public.td_monthly_net_interest_centavos(
  p_account public.account, p_start date, p_end date
) returns bigint language sql stable set search_path = public as $$
  with exposure as (
    select greatest(0::numeric,
      p_account.initial_balance_centavos::numeric * greatest(0, p_end - p_start)
      + coalesce(sum(
        (case when t.to_account_id = p_account.id then t.amount_centavos::numeric
              else -t.amount_centavos::numeric end)
        * greatest(0, p_end - greatest(p_start, t.date))
      ), 0)) as centavo_days
    from public.transaction t
    where (t.to_account_id = p_account.id or t.from_account_id = p_account.id)
      and t.date < p_end
  ), gross as (
    select round(centavo_days * p_account.interest_rate_bps / (10000::numeric * 365)) as amount
    from exposure
  ) select (amount - round(amount * 0.20))::bigint from gross;
$$;

create or replace function public.td_post_monthly_interest_due()
returns int language plpgsql security definer set search_path = public as $$
declare
  a public.account;
  v_rec public.recurring;
  v_remaining int;
  v_start date;
  v_end date;
  v_today date;
  v_tz text;
  v_tag uuid;
  v_amount bigint;
  v_protected_recurring_id uuid;
  v_count int := 0;
begin
  for a in select * from public.account
    where type = 'time-deposit' and interest_posting_interval = 'monthly'
      and not is_matured and not is_archived
    order by id for update skip locked
  loop
    select coalesce(timezone, 'Asia/Manila') into v_tz
      from public.user_profile where id = a.user_id;
    v_tz := coalesce(v_tz, 'Asia/Manila');
    v_today := (now() at time zone v_tz)::date;
    v_start := public.td_monthly_period_start(a);
    -- Completed limits survive deletion of the user-visible recurring row.
    if exists (select 1 from public.td_monthly_interest_state
      where account_id = a.id and is_completed) then continue; end if;
    -- Editable service labels cannot establish ownership of a schedule.
    -- Only the protected identity may restore a surviving missing backlink.
    if a.interest_recurring_id is null then
      select recurring_id into v_protected_recurring_id
        from public.td_monthly_interest_state where account_id = a.id;
      if v_protected_recurring_id is not null then
        select r.id into a.interest_recurring_id from public.recurring r
          where r.id = v_protected_recurring_id and r.user_id = a.user_id
          for update skip locked;
        -- A concurrent delete owns the old recurring and will clear its FKs.
        -- Retry next run instead of creating a duplicate while it is in flight.
        if a.interest_recurring_id is null and exists (
          select 1 from public.recurring where id = v_protected_recurring_id) then
          continue;
        end if;
      end if;
      if a.interest_recurring_id is null then
        a.interest_recurring_id := public.td_create_interest_recurring(a);
      end if;
      update public.account set interest_recurring_id = a.interest_recurring_id where id = a.id;
    end if;
    select * into v_rec from public.recurring
      where id = a.interest_recurring_id for update skip locked;
    if not found then continue; end if;
    if v_rec.is_paused or v_rec.is_completed then continue; end if;
    v_remaining := v_rec.remaining_occurrences;

    v_tag := public.td_interest_tag_id(a);
    if v_tag is null then
      -- No surviving reference: restore the default income tag rather than
      -- preventing every user's recurring transactions from being processed.
      insert into public.tag(user_id, name, type) values (a.user_id, 'interest-earned', 'income')
        on conflict (user_id, name, type) do update set name = excluded.name
        returning id into v_tag;
    end if;
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id, recurring_id)
      values (a.id, v_start, v_tag, a.interest_recurring_id)
      on conflict (account_id) do update set tag_id = excluded.tag_id,
        recurring_id = excluded.recurring_id,
        accrued_through = coalesce(td_monthly_interest_state.accrued_through, excluded.accrued_through);
    loop
      v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
      exit when v_start >= v_end or v_end > v_today;
      v_amount := public.td_monthly_net_interest_centavos(a, v_start, v_end);
      if v_amount > 0 then
        insert into public.transaction
          (user_id, type, tag_id, to_account_id, amount_centavos, date, description, recurring_id,
           is_installment_portion)
        values (a.user_id, 'income', v_tag, a.id, v_amount, v_end,
          case when nullif(btrim(v_rec.description), '') is not null then v_rec.description
            else format('Interest %s to %s (ACT/365, net of 20%% tax)', v_start, v_end - 1) end,
          a.interest_recurring_id, v_remaining is not null);
        v_count := v_count + 1;
        if v_remaining is not null then
          v_remaining := v_remaining - 1;
          update public.recurring set
            remaining_occurrences = v_remaining,
            is_completed = v_remaining = 0,
            completed_at = case when v_remaining = 0 then now() else null end,
            next_occurrence_at = v_end::timestamp at time zone v_tz
          where id = a.interest_recurring_id;
        end if;
      end if;
      v_start := v_end;
      insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
        values (a.id, v_start, v_tag)
        on conflict (account_id) do update set accrued_through = excluded.accrued_through;
      exit when v_remaining = 0;
    end loop;
    -- The recurring amount is an estimate for the next posting, not a fixed
    -- amount used by the scheduler. Unpause explicitly skips paused periods.
    v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
    if v_end > v_start and (v_remaining is null or v_remaining > 0) then
      update public.recurring set
        next_occurrence_at = v_end::timestamp at time zone v_tz,
        amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end))
      where id = a.interest_recurring_id;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.td_post_monthly_interest_due() from public, anon, authenticated;
grant execute on function public.td_post_monthly_interest_due() to service_role;

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
  v_remaining int;
  v_paused boolean := false;
begin
  v_pp_year := public.td_postings_per_year(p_account.interest_posting_interval);
  v_interval := public.td_recurring_interval(p_account.interest_posting_interval);
  if v_pp_year is null or v_interval is null then
    -- at-maturity: no recurring.
    return null;
  end if;

  v_tag_id := public.td_interest_tag_id(p_account);
  if v_tag_id is null then
    insert into public.tag(user_id, name, type)
      values (p_account.user_id, 'interest-earned', 'income')
      on conflict (user_id, name, type) do update set name = excluded.name
      returning id into v_tag_id;
  end if;

  v_amount := public.td_periodic_net_interest_centavos(
    p_account.principal_centavos, p_account.interest_rate_bps, v_pp_year
  );
  if p_account.interest_posting_interval = 'monthly' then
    -- This is only an estimate; a 31-day ACT/365 period may round positive
    -- even when the old annual/12 estimate rounds to zero.
    v_amount := greatest(1, v_amount);
  elsif v_amount <= 0 then
    -- Rounded to zero (tiny principal × tiny rate). Skip recurring; user can
    -- bump rate or use at-maturity to capture the cents.
    return null;
  end if;

  select coalesce(timezone, 'Asia/Manila') into v_tz
    from public.user_profile where id = p_account.user_id;
  v_anchor := (p_account.created_at at time zone coalesce(v_tz, 'Asia/Manila'))::date;

  if p_account.interest_posting_interval = 'monthly' then
    select case when not is_completed then remaining_occurrences end, is_paused
      into v_remaining, v_paused from public.td_monthly_interest_state
      where account_id = p_account.id;
  end if;
  -- next_occurrence_at is materialized by recurring_set_next_at trigger.
  insert into public.recurring
    (user_id, service, amount_centavos, type, tag_id,
     to_account_id, interval, first_occurrence_date, next_occurrence_at, remaining_occurrences, is_paused)
  values
    (p_account.user_id, p_account.name || ' — Interest', v_amount, 'income', v_tag_id,
     p_account.id, v_interval, v_anchor, now(), v_remaining, coalesce(v_paused, false) or p_account.is_archived)
  returning id into v_new_id;

  if p_account.interest_posting_interval = 'monthly' then
    v_anchor := public.td_monthly_period_start(p_account);
    update public.recurring set
      amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(
        p_account, v_anchor, least((date_trunc('month', v_anchor) + interval '1 month')::date,
          p_account.maturity_date))),
      next_occurrence_at = least((date_trunc('month', v_anchor) + interval '1 month')::date,
        p_account.maturity_date)::timestamp at time zone coalesce(v_tz, 'Asia/Manila')
      where id = v_new_id;
  end if;
  return v_new_id;
end;
$$;

create or replace function public.recurring_fire_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_fired int := 0;
  v_tz text;
  v_local_date date;
  v_next timestamptz;
  v_remaining int;
  v_completed boolean;
  v_is_installment boolean;
begin
  -- The hourly job and the daily maturity job share this entrypoint. Hold one
  -- transaction-scoped lock through maturity processing so overdue ledger
  -- entries cannot be divided between overlapping runs.
  perform pg_advisory_xact_lock(20261004, 1);
  for r in
    select * from public.recurring rec
     where is_paused = false
       and is_completed = false
       and next_occurrence_at <= now()
       and not exists (select 1 from public.account a
         where a.type = 'time-deposit' and a.interest_posting_interval = 'monthly'
           and a.interest_recurring_id = rec.id)
       and not exists (select 1 from public.td_monthly_interest_state st
         join public.account a on a.id = st.account_id
         where a.type = 'time-deposit' and a.interest_posting_interval = 'monthly'
           and st.recurring_id = rec.id)
     for update skip locked
  loop
    select timezone into v_tz from public.user_profile where id = r.user_id;
    if v_tz is null then v_tz := 'Asia/Manila'; end if;

    v_next := r.next_occurrence_at;
    v_remaining := r.remaining_occurrences;
    v_completed := false;
    v_is_installment := r.remaining_occurrences is not null;

    while v_next <= now() and not v_completed loop
      v_local_date := (v_next at time zone v_tz)::date;

      insert into public.transaction
        (user_id, amount_centavos, type, tag_id, from_account_id,
         to_account_id, fee_centavos, description, date, recurring_id,
         is_installment_portion)
      values
        (r.user_id, r.amount_centavos, r.type, r.tag_id, r.from_account_id,
         r.to_account_id, r.fee_centavos, r.description, v_local_date, r.id,
         v_is_installment);

      v_fired := v_fired + 1;

      if v_remaining is not null then
        v_remaining := v_remaining - 1;
        if v_remaining = 0 then
          update public.recurring set
            remaining_occurrences = 0,
            is_completed = true,
            completed_at = now(),
            next_occurrence_at = v_next
          where id = r.id;
          v_completed := true;
        end if;
      end if;

      if not v_completed then
        v_next := public.advance_recurring_next(
          r.first_occurrence_date, r.interval, v_next, v_tz
        );
      end if;
    end loop;

    if not v_completed then
      update public.recurring set
        remaining_occurrences = v_remaining,
        next_occurrence_at = v_next
      where id = r.id;
    end if;
  end loop;

  v_fired := v_fired + public.td_post_monthly_interest_due();
  return v_fired;
end;
$$;

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
  -- The daily maturity job must materialize overdue generic ledger entries
  -- before calculating the final period and retiring the generated schedule.
  perform public.recurring_fire_due();
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
      -- Delete (rather than pause) so the recurring no longer blocks account
      -- retirement. Hard-delete is still only possible when no historical
      -- transaction references this account; otherwise archive preserves the
      -- ledger history, which is the intended retirement path.
      delete from public.recurring where id = r.interest_recurring_id;
    end if;

    update public.account set is_matured = true where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- Repair and retime all existing monthly TDs. This only creates schedules;
-- ledger catch-up happens on the next hourly cron, not during migration.
do $$
declare a public.account; v_rec public.recurring; v_id uuid; v_start date; v_end date;
  v_tz text; v_tag uuid; v_anchor date; v_archive_owned_pause boolean;
begin
  for a in select * from public.account
    where type = 'time-deposit' and interest_posting_interval = 'monthly'
      and not is_matured for update
  loop
    v_start := public.td_monthly_period_start(a);
    -- Legacy archive actions had no pause provenance and always resumed on
    -- unarchive. Preserve that behavior for archived, incomplete schedules,
    -- including a missing row that this migration will replace.
    v_archive_owned_pause := a.is_archived and not coalesce(
      (select is_completed from public.recurring where id = a.interest_recurring_id), false);
    v_id := a.interest_recurring_id;
    if v_id is null then
      v_id := public.td_create_interest_recurring(a);
      update public.account set interest_recurring_id = v_id where id = a.id;
    end if;
    select * into a from public.account where id = a.id;
    v_tag := public.td_interest_tag_id(a);
    if v_tag is null then
      insert into public.tag(user_id, name, type) values (a.user_id, 'interest-earned', 'income')
        on conflict (user_id, name, type) do update set name = excluded.name
        returning id into v_tag;
    end if;
    select coalesce(timezone, 'Asia/Manila') into v_tz from public.user_profile where id = a.user_id;
    v_anchor := (a.created_at at time zone coalesce(v_tz, 'Asia/Manila'))::date;
    -- Deliberate one-time adoption of historical entries. Runtime processing
    -- never infers cursor changes from editable transaction dates.
    select greatest(v_start, coalesce(
      (select max(date) from public.transaction
        where to_account_id = a.id and type = 'income' and recurring_id = v_id),
      -- Older entries may have no recurring provenance. A deleted schedule
      -- clears transaction.recurring_id, and its tag may since have been
      -- renamed. Match the old fixed monthly amount on its anchored calendar
      -- date as a narrow fallback when the replacement tag cannot identify it.
      (select max(date) from public.transaction where to_account_id = a.id
        and type = 'income' and recurring_id is null
        and (tag_id = v_tag or (amount_centavos = public.td_periodic_net_interest_centavos(
          a.principal_centavos, a.interest_rate_bps, 12)
          and date = (v_anchor + (((extract(year from date)::int - extract(year from v_anchor)::int) * 12
            + extract(month from date)::int - extract(month from v_anchor)::int) || ' months')::interval)::date)))
    )) into v_start;
    select * into v_rec from public.recurring where id = v_id;
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id, recurring_id,
      is_completed, remaining_occurrences, is_paused, archive_owned_pause)
      values (a.id, v_start, v_tag, v_id, coalesce(v_rec.is_completed, false), v_rec.remaining_occurrences,
        v_rec.is_paused or (a.is_archived and not v_rec.is_completed), v_archive_owned_pause)
      on conflict (account_id) do nothing;
    v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
    -- Normalize generated mechanics previously editable in the UI, preserving
    -- user metadata, countdown, completion and historical ledger entries.
    update public.recurring set
      type = 'income', to_account_id = a.id, from_account_id = null, fee_centavos = null,
      tag_id = v_tag, interval = 'monthly', first_occurrence_date = v_end,
      amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end))
    where id = v_id;
    -- Changing interval/anchor invokes the generic date trigger. Restore the
    -- exact calendar date afterwards, including the prior date of completed rows.
    update public.recurring set
      next_occurrence_at = case when v_rec.is_completed then v_rec.next_occurrence_at
        else v_end::timestamp at time zone coalesce(v_tz, 'Asia/Manila') end,
      is_paused = v_rec.is_paused or (a.is_archived and not v_rec.is_completed)
    where id = v_id;
  end loop;
end;
$$;

create or replace function public.td_monthly_refresh_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.account; v_start date; v_end date; v_tz text; v_tag uuid;
  v_paused boolean; v_archive_owned_pause boolean;
begin
  -- An earlier AFTER trigger may have populated the backlink through a nested
  -- update. Its persisted row, rather than this outer NEW, is authoritative.
  select * into a from public.account where id = new.id;
  if a.type <> 'time-deposit' then return new; end if;
  if a.interest_posting_interval <> 'monthly' or a.is_matured then
    -- Retain the processed-period cursor, but retired schedules no longer
    -- reserve a tag that has no surviving ledger or recurring references.
    update public.td_monthly_interest_state set tag_id = null, recurring_id = null
      where account_id = a.id;
    return new;
  end if;
  if not old.is_archived and a.is_archived then
    -- Remember whether the pause existed before archive. Account archive owns
    -- only a newly introduced pause, even if its recurring is later deleted.
    select coalesce(
      (select r.is_paused from public.recurring r where r.id = a.interest_recurring_id),
      (select st.is_paused from public.td_monthly_interest_state st where st.account_id = a.id),
      false) into v_paused;
    insert into public.td_monthly_interest_state(account_id, is_paused, archive_owned_pause)
      values (a.id, true, not v_paused)
      on conflict (account_id) do update set archive_owned_pause = excluded.archive_owned_pause;
    update public.recurring set is_paused = true where id = a.interest_recurring_id;
  end if;
  if old.is_archived and not a.is_archived then
    -- Skip completed archived periods before releasing an archive-owned pause,
    -- including when the generated recurring was deleted during archive.
    select coalesce(timezone, 'Asia/Manila') into v_tz
      from public.user_profile where id = a.user_id;
    v_start := greatest(public.td_monthly_period_start(a),
      date_trunc('month', now() at time zone coalesce(v_tz, 'Asia/Manila'))::date);
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
      values (a.id, v_start, public.td_interest_tag_id(a))
      on conflict (account_id) do update set accrued_through = excluded.accrued_through;
    select archive_owned_pause into v_archive_owned_pause
      from public.td_monthly_interest_state where account_id = a.id;
    update public.td_monthly_interest_state set
      is_paused = case when v_archive_owned_pause then false else is_paused end,
      archive_owned_pause = false where account_id = a.id;
    if v_archive_owned_pause then
      update public.recurring set is_paused = false where id = a.interest_recurring_id;
    end if;
  end if;
  if a.interest_recurring_id is null then return new; end if;
  if exists (select 1 from public.recurring
    where id = a.interest_recurring_id and is_completed) then
    if old.interest_posting_interval is not distinct from a.interest_posting_interval then
      return new;
    end if;
    -- Periodic cadence changes reuse the row. An explicit return to monthly
    -- starts a fresh countdown while leaving manual pause and metadata intact.
    update public.recurring set is_completed = false, completed_at = null,
      remaining_occurrences = null where id = a.interest_recurring_id;
  end if;
  v_start := public.td_monthly_period_start(a);
  v_tag := public.td_interest_tag_id(a);
  if v_tag is null then
    insert into public.tag(user_id, name, type) values (a.user_id, 'interest-earned', 'income')
      on conflict (user_id, name, type) do update set name = excluded.name
      returning id into v_tag;
  end if;
  if old.interest_posting_interval is distinct from a.interest_posting_interval then
    select greatest(v_start, coalesce(
      (select max(date) from public.transaction where to_account_id = a.id
        and type = 'income' and recurring_id = coalesce(old.interest_recurring_id, a.interest_recurring_id)),
      (select max(date) from public.transaction where to_account_id = a.id
        and type = 'income' and recurring_id is null and tag_id = v_tag)
    )) into v_start;
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id, recurring_id,
      remaining_occurrences, is_paused)
      values (a.id, v_start, v_tag, a.interest_recurring_id,
        (select remaining_occurrences from public.recurring where id = a.interest_recurring_id),
        (select is_paused from public.recurring where id = a.interest_recurring_id))
      on conflict (account_id) do update set accrued_through = excluded.accrued_through,
        tag_id = excluded.tag_id, recurring_id = excluded.recurring_id,
        remaining_occurrences = excluded.remaining_occurrences,
        is_paused = excluded.is_paused, is_completed = false;
  else
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id, recurring_id)
      values (a.id, null, v_tag, a.interest_recurring_id)
      on conflict (account_id) do update set tag_id = excluded.tag_id, recurring_id = excluded.recurring_id;
  end if;
  v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
  select coalesce(timezone, 'Asia/Manila') into v_tz
    from public.user_profile where id = a.user_id;
  update public.recurring set
    type = 'income', to_account_id = a.id, from_account_id = null,
    fee_centavos = null, tag_id = v_tag, interval = 'monthly',
    first_occurrence_date = v_end,
    next_occurrence_at = v_end::timestamp at time zone coalesce(v_tz, 'Asia/Manila'),
    amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end))
  where id = a.interest_recurring_id;
  -- The generic recurring date trigger runs when the interval/anchor changes.
  update public.recurring set next_occurrence_at = v_end::timestamp at time zone
    coalesce(v_tz, 'Asia/Manila') where id = a.interest_recurring_id;
  return new;
end;
$$;
create trigger td_monthly_refresh_schedule_trg
  -- Ledger balance changes must not wait on a recurring row while holding the
  -- account lock: deleting that row takes the locks in the opposite order.
  -- The hourly processor recalculates the next estimate from the ledger.
  after update of interest_rate_bps, interest_posting_interval, maturity_date, interest_recurring_id, is_matured, is_archived
  on public.account for each row execute function public.td_monthly_refresh_schedule();

-- Resume skips completed calendar periods during an intentional pause. The
-- trigger runs after recurring_set_next_at and updates only the account linked
-- to this RLS-validated recurring; users cannot write the cursor directly.
create or replace function public.td_monthly_resume_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.account; v_tz text; v_start date; v_end date;
begin
  if not old.is_paused or new.is_paused or new.is_completed then return new; end if;
  select * into a from public.account where interest_recurring_id = new.id
    and user_id = new.user_id and type = 'time-deposit'
    and interest_posting_interval = 'monthly' and not is_matured;
  if not found then return new; end if;
  select coalesce(timezone, 'Asia/Manila') into v_tz from public.user_profile where id = a.user_id;
  v_tz := coalesce(v_tz, 'Asia/Manila');
  v_start := greatest(public.td_monthly_period_start(a),
    date_trunc('month', now() at time zone v_tz)::date);
  insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
    values (a.id, v_start, new.tag_id)
    on conflict (account_id) do update set accrued_through = excluded.accrued_through,
      tag_id = excluded.tag_id;
  v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
  new.next_occurrence_at := v_end::timestamp at time zone v_tz;
  new.amount_centavos := greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end));
  return new;
end;
$$;
create trigger zz_td_monthly_resume_schedule_trg
  before update of is_paused on public.recurring
  for each row execute function public.td_monthly_resume_schedule();

-- Keep completion and pause authoritative after a recurring is removed.
-- Explicitly resetting a surviving countdown clears completion here.
create or replace function public.td_monthly_remember_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.td_monthly_interest_state set is_completed = old.is_completed,
      remaining_occurrences = old.remaining_occurrences, is_paused = old.is_paused where recurring_id = old.id;
    return old;
  end if;
  if old.is_completed and old.remaining_occurrences is distinct from new.remaining_occurrences
    and (new.remaining_occurrences is null or new.remaining_occurrences > 0)
    and exists (select 1 from public.td_monthly_interest_state where recurring_id = new.id) then
    -- The UI edits only the countdown; resetting it deliberately starts a new
    -- countdown. The scheduler's decrement-to-zero completion is left intact.
    new.is_completed := false;
    new.completed_at := null;
  end if;
  update public.td_monthly_interest_state set is_completed = new.is_completed,
    remaining_occurrences = new.remaining_occurrences, is_paused = new.is_paused,
    archive_owned_pause = case when old.is_paused and not new.is_paused then false
      else archive_owned_pause end where recurring_id = new.id;
  return new;
end;
$$;
create trigger td_monthly_remember_completion_trg
  before update of is_completed, remaining_occurrences, is_paused or delete on public.recurring
  for each row execute function public.td_monthly_remember_completion();
