-- Monthly TDs accrue on ledger balances (including credited net interest),
-- ACT/365, with separately rounded gross interest and 20% withholding.
-- Other posting intervals retain their existing behavior.
create table public.td_monthly_interest_state (
  account_id uuid primary key references public.account(id) on delete cascade,
  accrued_through date not null,
  tag_id uuid not null references public.tag(id) on delete restrict
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
    (select r.tag_id from public.recurring r
      where r.user_id = p_account.user_id and r.to_account_id = p_account.id
        and r.type = 'income' and r.service = p_account.name || ' — Interest'
      order by r.created_at limit 1),
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
  v_start date;
  v_end date;
  v_today date;
  v_tz text;
  v_tag uuid;
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
    v_start := public.td_monthly_period_start(a);
    -- Restore missing schedules; do not create duplicate destination rows.
    if a.interest_recurring_id is null then
      select id into a.interest_recurring_id from public.recurring
        where user_id = a.user_id and to_account_id = a.id and type = 'income'
          and tag_id = public.td_interest_tag_id(a)
        order by created_at limit 1;
      if a.interest_recurring_id is null then
        a.interest_recurring_id := public.td_create_interest_recurring(a);
      end if;
      update public.account set interest_recurring_id = a.interest_recurring_id where id = a.id;
    end if;
    if exists (select 1 from public.recurring where id = a.interest_recurring_id
      and (is_paused or is_completed)) then continue; end if;

    v_tag := public.td_interest_tag_id(a);
    if v_tag is null then
      -- No surviving reference: restore the default income tag rather than
      -- preventing every user's recurring transactions from being processed.
      insert into public.tag(user_id, name, type) values (a.user_id, 'interest-earned', 'income')
        on conflict (user_id, name, type) do update set name = excluded.name
        returning id into v_tag;
    end if;
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
      values (a.id, v_start, v_tag)
      on conflict (account_id) do update set tag_id = excluded.tag_id;
    loop
      v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
      exit when v_start >= v_end or v_end > v_today;
      v_amount := public.td_monthly_net_interest_centavos(a, v_start, v_end);
      if v_amount > 0 then
        insert into public.transaction
          (user_id, type, tag_id, to_account_id, amount_centavos, date, description, recurring_id)
        values (a.user_id, 'income', v_tag, a.id, v_amount, v_end,
          format('Interest %s to %s (ACT/365, net of 20%% tax)',
            v_start, v_end - 1), a.interest_recurring_id);
        v_count := v_count + 1;
      end if;
      v_start := v_end;
      insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
        values (a.id, v_start, v_tag)
        on conflict (account_id) do update set accrued_through = excluded.accrued_through;
    end loop;
    -- The recurring amount is an estimate for the next posting, not a fixed
    -- amount used by the scheduler. Unpause explicitly skips paused periods.
    v_end := least((date_trunc('month', v_start) + interval '1 month')::date, a.maturity_date);
    if v_end > v_start then
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
  v_fired := public.td_post_monthly_interest_due();
  for r in
    select * from public.recurring rec
     where is_paused = false
       and is_completed = false
       and next_occurrence_at <= now()
       and not exists (select 1 from public.account a
         where a.id = rec.to_account_id and a.type = 'time-deposit'
           and a.interest_posting_interval = 'monthly'
           and (a.interest_recurring_id = rec.id
             or rec.tag_id = public.td_interest_tag_id(a)))
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
  perform public.td_post_monthly_interest_due();
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
declare a public.account; v_id uuid; v_start date; v_tz text; v_tag uuid;
begin
  for a in select * from public.account
    where type = 'time-deposit' and interest_posting_interval = 'monthly'
      and not is_matured for update
  loop
    v_start := public.td_monthly_period_start(a);
    v_id := a.interest_recurring_id;
    if v_id is null then
      select id into v_id from public.recurring
        where to_account_id = a.id and user_id = a.user_id and type = 'income'
          and tag_id = public.td_interest_tag_id(a)
        order by created_at limit 1;
      if v_id is null then v_id := public.td_create_interest_recurring(a); end if;
      update public.account set interest_recurring_id = v_id where id = a.id;
    end if;
    select * into a from public.account where id = a.id;
    v_tag := public.td_interest_tag_id(a);
    if v_tag is null then
      insert into public.tag(user_id, name, type) values (a.user_id, 'interest-earned', 'income')
        on conflict (user_id, name, type) do update set name = excluded.name
        returning id into v_tag;
    end if;
    -- Deliberate one-time adoption of historical entries. Runtime processing
    -- never infers cursor changes from editable transaction dates.
    select greatest(v_start, max(date)) into v_start from public.transaction
      where to_account_id = a.id and type = 'income' and tag_id = v_tag;
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
      values (a.id, v_start, v_tag) on conflict (account_id) do nothing;
    select coalesce(timezone, 'Asia/Manila') into v_tz from public.user_profile where id = a.user_id;
    update public.recurring set
      next_occurrence_at = least((date_trunc('month', v_start) + interval '1 month')::date,
        a.maturity_date)::timestamp at time zone coalesce(v_tz, 'Asia/Manila'),
      is_paused = is_paused or a.is_archived
    where id = v_id;
  end loop;
end;
$$;

create or replace function public.td_monthly_refresh_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_start date; v_end date; v_tz text; v_tag uuid;
begin
  if new.type <> 'time-deposit' or new.interest_posting_interval <> 'monthly'
    or new.is_matured or new.interest_recurring_id is null then return new; end if;
  v_start := public.td_monthly_period_start(new);
  if old.interest_posting_interval is distinct from new.interest_posting_interval then
    v_tag := public.td_interest_tag_id(new);
    select greatest(v_start, max(date)) into v_start from public.transaction
      where to_account_id = new.id and type = 'income' and tag_id = v_tag;
    insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
      values (new.id, v_start, v_tag)
      on conflict (account_id) do update set accrued_through = excluded.accrued_through,
        tag_id = excluded.tag_id;
  end if;
  v_end := least((date_trunc('month', v_start) + interval '1 month')::date, new.maturity_date);
  select coalesce(timezone, 'Asia/Manila') into v_tz
    from public.user_profile where id = new.user_id;
  update public.recurring set
    next_occurrence_at = v_end::timestamp at time zone coalesce(v_tz, 'Asia/Manila'),
    amount_centavos = greatest(1, public.td_monthly_net_interest_centavos(new, v_start, v_end))
  where id = new.interest_recurring_id;
  return new;
end;
$$;
create trigger td_monthly_refresh_schedule_trg
  after update of interest_rate_bps, interest_posting_interval, maturity_date, interest_recurring_id, balance_centavos
  on public.account for each row execute function public.td_monthly_refresh_schedule();

-- Resume skips completed calendar periods during an intentional pause. The
-- trigger runs after recurring_set_next_at and updates only the account linked
-- to this RLS-validated recurring; users cannot write the cursor directly.
create or replace function public.td_monthly_resume_schedule()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.account; v_tz text; v_start date; v_end date;
begin
  if not old.is_paused or new.is_paused then return new; end if;
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
