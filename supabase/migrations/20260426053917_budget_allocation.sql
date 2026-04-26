-- Slice 5: per-tag, per-month budget allocations.
-- budget_config (Slice 1) holds the overall monthly cap. This migration adds
-- the per-tag breakdown, with a strict trigger-enforced invariant:
--   Σ(budget_allocation.amount_centavos for (user_id, month))
--     ≤ COALESCE(budget_config.overall_centavos for (user_id, month), 0)

create table public.budget_allocation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  tag_id uuid not null references public.tag (id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month, tag_id)
);
create index budget_allocation_user_month_idx
  on public.budget_allocation (user_id, month);
create index budget_allocation_tag_idx
  on public.budget_allocation (tag_id);

alter table public.budget_allocation enable row level security;
create policy budget_allocation_select_own on public.budget_allocation
  for select using (auth.uid() = user_id);
create policy budget_allocation_insert_own on public.budget_allocation
  for insert with check (auth.uid() = user_id);
create policy budget_allocation_update_own on public.budget_allocation
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy budget_allocation_delete_own on public.budget_allocation
  for delete using (auth.uid() = user_id);

-- Reuse the generic touch_updated_at trigger from Slice 2.
create trigger budget_allocation_touch_updated_at
  before update on public.budget_allocation
  for each row execute function public.touch_updated_at();

-- Cap enforcement. Absent config row is treated as overall=0, so any positive
-- allocation is rejected until the user explicitly sets an overall for that
-- month. Keeps DB and UX state in lockstep.
create or replace function public.enforce_budget_cap(p_user_id uuid, p_month text)
returns void
language plpgsql
as $$
declare
  v_sum     bigint;
  v_overall bigint;
begin
  select coalesce(sum(amount_centavos), 0) into v_sum
    from public.budget_allocation
   where user_id = p_user_id and month = p_month;

  select coalesce(overall_centavos, 0) into v_overall
    from public.budget_config
   where user_id = p_user_id and month = p_month;

  v_overall := coalesce(v_overall, 0);

  if v_sum > v_overall then
    raise exception
      'Budget allocations (%) exceed overall cap (%) for %',
      v_sum, v_overall, p_month
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.budget_allocation_enforce_cap()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_budget_cap(new.user_id, new.month);
  return new;
end;
$$;

create trigger budget_allocation_cap_check
  after insert or update on public.budget_allocation
  for each row execute function public.budget_allocation_enforce_cap();

create or replace function public.budget_config_enforce_cap()
returns trigger
language plpgsql
as $$
begin
  -- Re-check only on a reduction. Increases trivially preserve Σ ≤ overall.
  if new.overall_centavos < old.overall_centavos then
    perform public.enforce_budget_cap(new.user_id, new.month);
  end if;
  return new;
end;
$$;

create trigger budget_config_cap_check
  after update of overall_centavos on public.budget_config
  for each row execute function public.budget_config_enforce_cap();
