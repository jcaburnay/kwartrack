-- Slice 2: accounts + groups + five account types.
-- Flat-column account table with a per-type CHECK constraint, plus triggers for
-- balance seeding, immutable-field enforcement, and updated_at maintenance.

create type public.account_type as enum ('cash', 'e-wallet', 'savings', 'credit', 'time-deposit');
create type public.posting_interval as enum ('monthly', 'quarterly', 'semi-annual', 'annual', 'at-maturity');

create table public.account_group (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index account_group_user_id_idx on public.account_group (user_id);

create table public.account (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 50),
  type public.account_type not null,
  group_id uuid references public.account_group (id) on delete set null,
  initial_balance_centavos bigint not null check (initial_balance_centavos >= 0),
  balance_centavos bigint not null default 0 check (balance_centavos >= 0),
  is_archived boolean not null default false,

  -- credit-only
  credit_limit_centavos bigint,
  installment_limit_centavos bigint,

  -- time-deposit-only
  principal_centavos bigint,
  interest_rate_bps integer,
  maturity_date date,
  interest_posting_interval public.posting_interval,
  is_matured boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, name),

  constraint account_type_fields_match check (
    (type = 'credit' and
       credit_limit_centavos is not null and credit_limit_centavos > 0 and
       (installment_limit_centavos is null or installment_limit_centavos >= 0) and
       principal_centavos is null and interest_rate_bps is null and
       maturity_date is null and interest_posting_interval is null)
    or
    (type = 'time-deposit' and
       principal_centavos is not null and principal_centavos > 0 and
       interest_rate_bps is not null and interest_rate_bps > 0 and
       maturity_date is not null and
       interest_posting_interval is not null and
       initial_balance_centavos = principal_centavos and
       credit_limit_centavos is null and installment_limit_centavos is null)
    or
    (type in ('cash', 'e-wallet', 'savings') and
       credit_limit_centavos is null and installment_limit_centavos is null and
       principal_centavos is null and interest_rate_bps is null and
       maturity_date is null and interest_posting_interval is null)
  )
);
create index account_user_id_idx on public.account (user_id);
create index account_group_id_idx on public.account (group_id);

-- RLS.

alter table public.account_group enable row level security;
create policy account_group_select_own on public.account_group
  for select using (auth.uid() = user_id);
create policy account_group_insert_own on public.account_group
  for insert with check (auth.uid() = user_id);
create policy account_group_update_own on public.account_group
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy account_group_delete_own on public.account_group
  for delete using (auth.uid() = user_id);

alter table public.account enable row level security;
create policy account_select_own on public.account
  for select using (auth.uid() = user_id);
create policy account_insert_own on public.account
  for insert with check (auth.uid() = user_id);
create policy account_update_own on public.account
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy account_delete_own on public.account
  for delete using (auth.uid() = user_id);

-- On-insert: seed balance from initial_balance_centavos and enforce credit-limit bound.
create or replace function public.seed_account_balance()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'credit' and new.initial_balance_centavos > new.credit_limit_centavos then
    raise exception 'initial balance (%) exceeds credit limit (%)',
      new.initial_balance_centavos, new.credit_limit_centavos;
  end if;
  new.balance_centavos := new.initial_balance_centavos;
  return new;
end;
$$;

create trigger account_seed_balance
  before insert on public.account
  for each row execute function public.seed_account_balance();

-- On-update: block immutable fields (type, initial_balance_centavos, principal_centavos).
create or replace function public.account_block_immutable_updates()
returns trigger
language plpgsql
as $$
begin
  if new.type <> old.type then
    raise exception 'account.type is immutable';
  end if;
  if new.initial_balance_centavos <> old.initial_balance_centavos then
    raise exception 'account.initial_balance_centavos is immutable';
  end if;
  if old.principal_centavos is not null and
     (new.principal_centavos is null or new.principal_centavos <> old.principal_centavos) then
    raise exception 'account.principal_centavos is immutable';
  end if;
  return new;
end;
$$;

create trigger account_block_immutable
  before update on public.account
  for each row execute function public.account_block_immutable_updates();

-- Generic updated_at maintenance (applied to account, account_group, and retroactively to user_profile).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger account_touch_updated_at
  before update on public.account
  for each row execute function public.touch_updated_at();

create trigger account_group_touch_updated_at
  before update on public.account_group
  for each row execute function public.touch_updated_at();

create trigger user_profile_touch_updated_at
  before update on public.user_profile
  for each row execute function public.touch_updated_at();
