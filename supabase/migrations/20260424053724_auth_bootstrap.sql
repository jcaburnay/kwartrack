-- Slice 1: auth + user bootstrap.
-- Tables for user_profile, tag, budget_config; RLS; handle_new_user trigger that
-- seeds a profile + 27 default tags + one empty budget_config row for the user's
-- signup month (in their local timezone) whenever a row lands in auth.users.

create type public.tag_type as enum ('expense', 'income', 'transfer', 'any');

-- User profile: id IS the auth uid; FK cascades so auth deletion nukes the profile.
create table public.user_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 50),
  timezone text not null default 'Asia/Manila',
  theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags: per-user, FK-based references across transactions/recurrings/budget/splits.
create table public.tag (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 50),
  type public.tag_type not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);
create index tag_user_id_idx on public.tag (user_id);

-- Budget config: per-user, per-calendar-month snapshot.
create table public.budget_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  overall_centavos bigint not null default 0 check (overall_centavos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
create index budget_config_user_id_idx on public.budget_config (user_id);

-- RLS: everything locked down to auth.uid().

alter table public.user_profile enable row level security;
-- user_profile: only SELECT + UPDATE by the owner. No INSERT (trigger handles it via
-- SECURITY DEFINER; exposing it would let a client create orphan profile rows). No
-- DELETE (auth.users ON DELETE CASCADE is the only legitimate path; exposing it
-- would let a client orphan their own seeded tags/budget).
create policy user_profile_select_own on public.user_profile
  for select using (auth.uid() = id);
create policy user_profile_update_own on public.user_profile
  for update using (auth.uid() = id) with check (auth.uid() = id);

alter table public.tag enable row level security;
create policy tag_select_own on public.tag
  for select using (auth.uid() = user_id);
create policy tag_insert_own on public.tag
  for insert with check (auth.uid() = user_id);
create policy tag_update_own on public.tag
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tag_delete_own on public.tag
  for delete using (auth.uid() = user_id);

alter table public.budget_config enable row level security;
create policy budget_config_select_own on public.budget_config
  for select using (auth.uid() = user_id);
create policy budget_config_insert_own on public.budget_config
  for insert with check (auth.uid() = user_id);
create policy budget_config_update_own on public.budget_config
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy budget_config_delete_own on public.budget_config
  for delete using (auth.uid() = user_id);

-- Signup trigger: seeds profile + 27 default tags + one budget_config row.
-- SECURITY DEFINER so it can insert across tables regardless of RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  v_timezone     text := coalesce(new.raw_user_meta_data ->> 'timezone', 'Asia/Manila');
  v_month        text := to_char((now() at time zone v_timezone)::date, 'YYYY-MM');
begin
  insert into public.user_profile (id, display_name, timezone, theme)
  values (new.id, v_display_name, v_timezone, 'system');

  insert into public.tag (user_id, name, type, is_system) values
    -- Default expense tags.
    (new.id, 'foods', 'expense', false),
    (new.id, 'grocery', 'expense', false),
    (new.id, 'transportation', 'expense', false),
    (new.id, 'online-shopping', 'expense', false),
    (new.id, 'gadgets', 'expense', false),
    (new.id, 'bills', 'expense', false),
    (new.id, 'pets', 'expense', false),
    (new.id, 'personal-care', 'expense', false),
    (new.id, 'health', 'expense', false),
    (new.id, 'digital-subscriptions', 'expense', false),
    (new.id, 'entertainment', 'expense', false),
    (new.id, 'clothing', 'expense', false),
    (new.id, 'education', 'expense', false),
    (new.id, 'travel', 'expense', false),
    (new.id, 'housing', 'expense', false),
    (new.id, 'insurance', 'expense', false),
    (new.id, 'gifts', 'expense', false),
    (new.id, 'dates', 'expense', false),
    (new.id, 'interest-paid', 'expense', false),
    -- Default income tags (note: 'gifts' is intentionally duplicated across scopes).
    (new.id, 'monthly-salary', 'income', false),
    (new.id, 'freelance', 'income', false),
    (new.id, 'interest-earned', 'income', false),
    (new.id, 'bonus', 'income', false),
    (new.id, 'gifts', 'income', false),
    -- System tags (hidden from user-picker UI).
    (new.id, 'transfer-fees', 'expense', true),
    (new.id, 'debt-settlement', 'any', true),
    (new.id, 'debt-settlement-orphan', 'any', true);

  insert into public.budget_config (user_id, month, overall_centavos)
  values (new.id, v_month, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
