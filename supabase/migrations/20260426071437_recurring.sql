-- Slice 6: recurring entities (subscriptions / installments / recurring income).
-- Single `recurring` table with the same per-type CHECK as `transaction`.
-- A BEFORE INSERT/UPDATE trigger keeps `next_occurrence_at` in lockstep with
-- the inputs that determine it. An hourly pg_cron job fires due rows: each
-- fire inserts a real transaction (so the existing balance + paired-fee
-- AFTER triggers do the heavy lifting) and advances `next_occurrence_at`.

create extension if not exists pg_cron with schema extensions;

create type public.recurring_interval as enum
  ('weekly', 'monthly', 'quarterly', 'semi_annual', 'annual');

create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  service text not null check (length(service) between 1 and 80),
  amount_centavos bigint not null check (amount_centavos > 0),
  type public.transaction_type not null,
  tag_id uuid references public.tag (id) on delete restrict,
  from_account_id uuid references public.account (id) on delete restrict,
  to_account_id uuid references public.account (id) on delete restrict,
  fee_centavos bigint check (fee_centavos is null or fee_centavos > 0),
  description text,
  interval public.recurring_interval not null,
  first_occurrence_date date not null,
  next_occurrence_at timestamptz not null,
  -- Application validates `> 0` on input; DB allows 0 so cron can mark
  -- completion (remaining=0, is_completed=true) without violating a check.
  remaining_occurrences int check (remaining_occurrences is null or remaining_occurrences >= 0),
  is_paused boolean not null default false,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rec_type_fields check (
    (type = 'expense'
       and from_account_id is not null and to_account_id is null
       and fee_centavos is null and tag_id is not null)
    or
    (type = 'income'
       and from_account_id is null and to_account_id is not null
       and fee_centavos is null and tag_id is not null)
    or
    (type = 'transfer'
       and from_account_id is not null and to_account_id is not null
       and from_account_id <> to_account_id)
  ),
  constraint rec_completion_consistent check (
    (is_completed = false and completed_at is null)
    or
    (is_completed = true and completed_at is not null)
  )
);

create index recurring_due_idx
  on public.recurring (next_occurrence_at)
  where is_paused = false and is_completed = false;
create index recurring_user_idx on public.recurring (user_id);
create index recurring_tag_idx on public.recurring (tag_id);

alter table public.transaction
  add column recurring_id uuid references public.recurring (id) on delete set null;
create index tx_recurring_idx on public.transaction (recurring_id)
  where recurring_id is not null;

alter table public.recurring enable row level security;
create policy recurring_select_own on public.recurring
  for select using (auth.uid() = user_id);
create policy recurring_insert_own on public.recurring
  for insert with check (auth.uid() = user_id);
create policy recurring_update_own on public.recurring
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_delete_own on public.recurring
  for delete using (auth.uid() = user_id);

create trigger recurring_touch_updated_at
  before update on public.recurring
  for each row execute function public.touch_updated_at();

-- Compute the first FUTURE occurrence anchored at p_anchor, stepping by the
-- interval, in p_tz. If anchor is today/future, use it as-is; if past, step
-- forward until we land at or after today-in-tz. Postgres
-- `(date + 'N months'::interval)::date` clamps month-end correctly: anchor
-- Jan 31 + 1 month = Feb 28/29; + 2 months = Mar 31 (anchor preserved).
create or replace function public.recurring_initial_next_at(
  p_anchor date,
  p_interval public.recurring_interval,
  p_tz text
)
returns timestamptz
language plpgsql
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_k     int := 0;
  v_cand  date;
  v_step_months int;
begin
  if p_interval = 'weekly' then
    v_cand := p_anchor;
    while v_cand < v_today loop
      v_k := v_k + 1;
      v_cand := p_anchor + (v_k * 7);
      if v_k > 100000 then
        raise exception 'recurring_initial_next_at: anchor too far in the past';
      end if;
    end loop;
    return (v_cand::timestamp at time zone p_tz);
  end if;

  v_step_months := case p_interval
    when 'monthly'     then 1
    when 'quarterly'   then 3
    when 'semi_annual' then 6
    when 'annual'      then 12
  end;

  loop
    v_cand := (p_anchor + ((v_k * v_step_months) || ' months')::interval)::date;
    exit when v_cand >= v_today;
    v_k := v_k + 1;
    if v_k > 100000 then
      raise exception 'recurring_initial_next_at: anchor too far in the past';
    end if;
  end loop;

  return (v_cand::timestamp at time zone p_tz);
end;
$$;

-- Given the current next_occurrence_at (a timestamptz at midnight local-tz),
-- return the NEXT one. Recovers k from the current local-date relative to
-- anchor and re-projects from the anchor so monthly clamping is preserved
-- (anchor day-of-month is the source of truth).
create or replace function public.advance_recurring_next(
  p_anchor date,
  p_interval public.recurring_interval,
  p_current_next timestamptz,
  p_tz text
)
returns timestamptz
language plpgsql
as $$
declare
  v_cur_local date := (p_current_next at time zone p_tz)::date;
  v_next_local date;
  v_k_months int;
  v_step_months int;
begin
  if p_interval = 'weekly' then
    v_next_local := v_cur_local + 7;
    return (v_next_local::timestamp at time zone p_tz);
  end if;

  v_step_months := case p_interval
    when 'monthly'     then 1
    when 'quarterly'   then 3
    when 'semi_annual' then 6
    when 'annual'      then 12
  end;

  v_k_months :=
    (extract(year  from v_cur_local)::int * 12 + extract(month from v_cur_local)::int)
    - (extract(year from p_anchor)::int    * 12 + extract(month from p_anchor)::int);

  v_next_local := (p_anchor + ((v_k_months + v_step_months) || ' months')::interval)::date;
  return (v_next_local::timestamp at time zone p_tz);
end;
$$;

-- BEFORE INSERT/UPDATE: refresh next_occurrence_at when its inputs change.
-- Spec rule: amount/from/to/type/fee edits don't touch the schedule.
create or replace function public.recurring_set_next_at()
returns trigger
language plpgsql
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.user_profile where id = new.user_id;
  if v_tz is null then v_tz := 'Asia/Manila'; end if;

  if TG_OP = 'INSERT' then
    new.next_occurrence_at := public.recurring_initial_next_at(
      new.first_occurrence_date, new.interval, v_tz
    );
    return new;
  end if;

  if old.interval is distinct from new.interval
     or old.first_occurrence_date is distinct from new.first_occurrence_date
     or (old.is_paused = true and new.is_paused = false) then
    new.next_occurrence_at := public.recurring_initial_next_at(
      new.first_occurrence_date, new.interval, v_tz
    );
  end if;

  return new;
end;
$$;

create trigger recurring_set_next_at_trg
  before insert or update on public.recurring
  for each row execute function public.recurring_set_next_at();

-- Hourly cron entrypoint. Iterates due rows with FOR UPDATE SKIP LOCKED so a
-- manual `select recurring_fire_due()` (e.g. from tests) cannot race the
-- schedule. For each due row, loops while next_occurrence_at <= now() —
-- handles cron-downtime catchup by firing each missed occurrence with its
-- original local-tz date as the transaction `date`.
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
begin
  for r in
    select * from public.recurring
     where is_paused = false
       and is_completed = false
       and next_occurrence_at <= now()
     for update skip locked
  loop
    select timezone into v_tz from public.user_profile where id = r.user_id;
    if v_tz is null then v_tz := 'Asia/Manila'; end if;

    v_next := r.next_occurrence_at;
    v_remaining := r.remaining_occurrences;
    v_completed := false;

    while v_next <= now() and not v_completed loop
      v_local_date := (v_next at time zone v_tz)::date;

      insert into public.transaction
        (user_id, amount_centavos, type, tag_id, from_account_id,
         to_account_id, fee_centavos, description, date, recurring_id)
      values
        (r.user_id, r.amount_centavos, r.type, r.tag_id, r.from_account_id,
         r.to_account_id, r.fee_centavos, r.description, v_local_date, r.id);

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

-- Schedule hourly. cron.schedule replaces the existing job with the same
-- name on each migration apply, so `db reset` is idempotent.
select cron.schedule(
  'recurring-fire-hourly',
  '0 * * * *',
  $cron$ select public.recurring_fire_due(); $cron$
);
