-- Monthly TDs accrue on ledger balances (including credited net interest),
-- ACT/365, with separately rounded gross interest and 20% withholding.
-- Other posting intervals retain their existing behavior.
create table public.td_monthly_interest_state (
  account_id uuid primary key references public.account(id) on delete cascade,
  -- Provenance may exist before funding; initialize the cursor on processing.
  accrued_through date,
  -- Old schedules and transactions were editable, so migration cannot always
  -- prove whether an earlier month was already paid. Never auto-credit an
  -- uncertain historical period; expose it for explicit reconciliation.
  needs_reconciliation boolean not null default false,
  reconciliation_cutover date
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

-- The user can acknowledge historical reconciliation after comparing bank
-- statements and entering any missing credits as ordinary income. This does
-- not change the protected posting cursor or create an interest transaction.
create or replace function public.td_confirm_interest_reconciliation(p_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.account
    where id = p_account_id and user_id = auth.uid() and type = 'time-deposit'
      and interest_posting_interval = 'monthly') then
    raise exception 'Monthly time deposit not found';
  end if;
  update public.td_monthly_interest_state set needs_reconciliation = false
    where account_id = p_account_id;
end;
$$;
revoke execute on function public.td_confirm_interest_reconciliation(uuid) from public, anon;
grant execute on function public.td_confirm_interest_reconciliation(uuid) to authenticated;

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
  v_amount bigint;
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
    -- The account owns the paid-period cursor. Generated schedules cannot be
    -- deleted by users; maturity removes them only after final processing.
    if a.interest_recurring_id is null then continue; end if;
    select * into v_rec from public.recurring
      where id = a.interest_recurring_id for update skip locked;
    if not found then continue; end if;
    if v_rec.is_paused or v_rec.is_completed then continue; end if;
    v_start := public.td_monthly_period_start(a);
    v_remaining := v_rec.remaining_occurrences;
    insert into public.td_monthly_interest_state(account_id, accrued_through)
      values (a.id, v_start) on conflict (account_id) do nothing;
    loop
      v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
      exit when v_start >= v_end or v_end > v_today;
      v_amount := public.td_monthly_net_interest_centavos(a, v_start, v_end);
      if v_amount > 0 then
        insert into public.transaction
          (user_id, type, tag_id, to_account_id, amount_centavos, date, description, recurring_id,
           is_installment_portion)
        values (a.user_id, 'income', v_rec.tag_id, a.id, v_amount, v_end,
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
      update public.td_monthly_interest_state set accrued_through = v_start where account_id = a.id;
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
begin
  v_pp_year := public.td_postings_per_year(p_account.interest_posting_interval);
  v_interval := public.td_recurring_interval(p_account.interest_posting_interval);
  if v_pp_year is null or v_interval is null then
    -- at-maturity: no recurring.
    return null;
  end if;

  select id into v_tag_id from public.tag
    where user_id = p_account.user_id and name = 'interest-earned' and type = 'income';
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

  -- next_occurrence_at is materialized by recurring_set_next_at trigger.
  insert into public.recurring
    (user_id, service, amount_centavos, type, tag_id,
     to_account_id, interval, first_occurrence_date, next_occurrence_at, is_paused)
  values
    (p_account.user_id, p_account.name || ' — Interest', v_amount, 'income', v_tag_id,
     p_account.id, v_interval, v_anchor, now(), p_account.is_archived)
  returning id into v_new_id;

  if p_account.interest_posting_interval = 'monthly' then
    v_anchor := public.td_monthly_period_start(p_account);
    update public.recurring set
      amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(
        p_account, v_anchor, least((date_trunc('month', v_anchor) + interval '1 month')::date,
          p_account.maturity_date))),
      first_occurrence_date = least((date_trunc('month', v_anchor) + interval '1 month')::date,
        p_account.maturity_date),
      next_occurrence_at = least((date_trunc('month', v_anchor) + interval '1 month')::date,
        p_account.maturity_date)::timestamp at time zone coalesce(v_tz, 'Asia/Manila')
      where id = v_new_id;
    update public.recurring set next_occurrence_at = least(
      (date_trunc('month', v_anchor) + interval '1 month')::date,
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


-- Older recurring dates and transactions were editable and may have been
-- deleted. No migration can prove every historical period was paid. Preserve
-- the ledger, start automatic posting prospectively, and mark uncertain older
-- accounts for explicit reconciliation instead of risking duplicate income.
do $$
declare
  a public.account;
  v_rec public.recurring;
  v_start date;
  v_cutover date;
  v_end date;
  v_tz text;
  v_tag uuid;
  v_needs_reconciliation boolean;
begin
  for a in select * from public.account
    where type = 'time-deposit' and interest_posting_interval = 'monthly'
      and not is_matured for update
  loop
    select coalesce(timezone, 'Asia/Manila') into v_tz
      from public.user_profile where id = a.user_id;
    v_tz := coalesce(v_tz, 'Asia/Manila');
    v_start := public.td_monthly_period_start(a);
    v_cutover := date_trunc('month', now() at time zone v_tz)::date;
    v_needs_reconciliation := v_start < v_cutover;
    v_start := greatest(v_start, v_cutover);
    insert into public.td_monthly_interest_state(
      account_id, accrued_through, needs_reconciliation, reconciliation_cutover)
      values (a.id, v_start, v_needs_reconciliation,
        case when v_needs_reconciliation then v_cutover end)
      on conflict (account_id) do nothing;

    if a.interest_recurring_id is null then
      a.interest_recurring_id := public.td_create_interest_recurring(a);
      update public.account set interest_recurring_id = a.interest_recurring_id where id = a.id;
    end if;
    select * into v_rec from public.recurring where id = a.interest_recurring_id;
    if not found then continue; end if;
    v_tag := v_rec.tag_id;
    if not exists (select 1 from public.tag
      where id = v_tag and user_id = a.user_id and type = 'income') then
      select id into v_tag from public.tag
        where user_id = a.user_id and name = 'interest-earned' and type = 'income';
      if v_tag is null then
        insert into public.tag(user_id, name, type)
          values (a.user_id, 'interest-earned', 'income')
          on conflict (user_id, name, type) do update set name = excluded.name
          returning id into v_tag;
      end if;
    end if;
    v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
    update public.recurring set
      type = 'income', to_account_id = a.id, from_account_id = null, fee_centavos = null,
      tag_id = v_tag, interval = 'monthly', first_occurrence_date = v_end,
      amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end))
    where id = a.interest_recurring_id;
    -- The generic recurring trigger recomputes dates when the anchor changes.
    update public.recurring set
      next_occurrence_at = case when v_rec.is_completed then v_rec.next_occurrence_at
        else v_end::timestamp at time zone v_tz end
    where id = a.interest_recurring_id;
  end loop;
end;
$$;

-- The legacy account trigger still maintains other posting intervals. It
-- performs generated monthly changes as the function owner, while direct
-- authenticated edits to calculated recurring fields are rejected below.
alter function public.td_account_after_update() security definer;
alter function public.td_account_after_update() set search_path = public;

create or replace function public.td_monthly_refresh_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a public.account;
  v_start date;
  v_end date;
  v_tz text;
begin
  -- A nested legacy trigger may have created the backlink; read its persisted
  -- value rather than the outer UPDATE's stale NEW row.
  select * into a from public.account where id = new.id;
  if a.type <> 'time-deposit' or a.interest_posting_interval <> 'monthly'
    or a.is_matured then return new; end if;

  select coalesce(timezone, 'Asia/Manila') into v_tz
    from public.user_profile where id = a.user_id;
  v_tz := coalesce(v_tz, 'Asia/Manila');
  if old.is_archived and not a.is_archived
    or old.interest_posting_interval is distinct from a.interest_posting_interval then
    -- No interest is owed for the time an account was archived or on another
    -- cadence. The next hourly run refreshes the visible estimate.
    v_start := greatest(public.td_monthly_period_start(a),
      date_trunc('month', now() at time zone v_tz)::date);
    insert into public.td_monthly_interest_state(account_id, accrued_through)
      values (a.id, v_start)
      on conflict (account_id) do update set accrued_through = excluded.accrued_through;
    if old.is_archived and not a.is_archived then return new; end if;
  end if;
  -- Archive is an account-level posting gate. Never mutate the recurring
  -- under the account lock solely to archive or unarchive.
  if old.is_archived is distinct from a.is_archived then return new; end if;
  if a.interest_recurring_id is null then return new; end if;

  if old.interest_posting_interval is distinct from a.interest_posting_interval then
    -- Explicitly returning to monthly starts a fresh occurrence limit.
    update public.recurring set is_completed = false, completed_at = null,
      remaining_occurrences = null where id = a.interest_recurring_id;
  end if;
  v_start := public.td_monthly_period_start(a);
  v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
  update public.recurring set
    type = 'income', to_account_id = a.id, from_account_id = null,
    fee_centavos = null, interval = 'monthly', first_occurrence_date = v_end,
    next_occurrence_at = v_end::timestamp at time zone v_tz,
    amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end))
  where id = a.interest_recurring_id;
  -- The generic recurring date trigger runs when the anchor changes.
  update public.recurring set next_occurrence_at = v_end::timestamp at time zone v_tz
    where id = a.interest_recurring_id;
  return new;
end;
$$;
create trigger td_monthly_refresh_schedule_trg
  after update of interest_rate_bps, interest_posting_interval, maturity_date,
    interest_recurring_id, is_matured, is_archived
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
  insert into public.td_monthly_interest_state(account_id, accrued_through)
    values (a.id, v_start)
    on conflict (account_id) do update set accrued_through = excluded.accrued_through;
  v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
  new.next_occurrence_at := v_end::timestamp at time zone v_tz;
  new.amount_centavos := greatest(1, public.td_monthly_net_interest_centavos(a, v_start, v_end));
  return new;
end;
$$;
create trigger zz_td_monthly_resume_schedule_trg
  before update of is_paused on public.recurring
  for each row execute function public.td_monthly_resume_schedule();

-- A generated monthly schedule is a user-facing control surface, not the
-- authority for paid periods. Users may edit tag, description, pause, and
-- occurrence limit; deleting it or changing calculated fields would break
-- the link to the protected account cursor.
create or replace function public.td_monthly_protect_recurring()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or not exists (
    select 1 from public.account a where a.interest_recurring_id = old.id
      and a.type = 'time-deposit' and not a.is_matured
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Pause this generated interest schedule instead of deleting it';
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.service is distinct from old.service
    or new.amount_centavos is distinct from old.amount_centavos
    or new.type is distinct from old.type or new.from_account_id is distinct from old.from_account_id
    or new.to_account_id is distinct from old.to_account_id
    or new.fee_centavos is distinct from old.fee_centavos
    or new.interval is distinct from old.interval
    or new.first_occurrence_date is distinct from old.first_occurrence_date
    or new.next_occurrence_at is distinct from old.next_occurrence_at
    or new.is_completed is distinct from old.is_completed
    or new.completed_at is distinct from old.completed_at then
    raise exception 'Calculated monthly interest schedule fields cannot be edited';
  end if;
  return new;
end;
$$;
create trigger a_td_monthly_protect_recurring_trg
  before update or delete on public.recurring
  for each row execute function public.td_monthly_protect_recurring();

-- Resetting the visible occurrence limit deliberately restarts a completed
-- schedule. This trigger runs after the guard, so clients need not write the
-- calculated completion fields themselves.
create or replace function public.td_monthly_reset_completion()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.is_completed and old.remaining_occurrences is distinct from new.remaining_occurrences
    and (new.remaining_occurrences is null or new.remaining_occurrences > 0)
    and exists (select 1 from public.account a where a.interest_recurring_id = new.id
      and a.type = 'time-deposit' and a.interest_posting_interval = 'monthly') then
    new.is_completed := false;
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger td_monthly_reset_completion_trg
  before update of remaining_occurrences on public.recurring
  for each row execute function public.td_monthly_reset_completion();

-- The backlink is owned by the account lifecycle triggers. A direct client
-- update could otherwise detach the schedule and let generic recurring cron
-- post the fixed display estimate as income.
alter function public.td_account_after_insert() security definer;
alter function public.td_account_after_insert() set search_path = public;
create or replace function public.td_monthly_protect_backlink()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated'
    and old.type = 'time-deposit' then
    if old.interest_recurring_id is distinct from new.interest_recurring_id then
      raise exception 'Generated interest schedule links cannot be edited';
    end if;
    if old.is_matured is distinct from new.is_matured then
      raise exception 'Monthly time deposit maturity is managed automatically';
    end if;
  end if;
  return new;
end;
$$;
create trigger a_td_monthly_protect_backlink_trg
  before update of interest_recurring_id, is_matured on public.account
  for each row execute function public.td_monthly_protect_backlink();
