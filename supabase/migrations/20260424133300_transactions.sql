-- Slice 3: transactions.
-- Single `transaction` table covering expense / income / transfer, with a
-- per-type CHECK; an AFTER trigger that applies balance deltas to `account`
-- on INSERT/UPDATE/DELETE; and a second trigger that keeps a paired
-- `transfer-fees` expense row in lockstep with the parent transfer via
-- `parent_transaction_id` (ON DELETE CASCADE handles removal).

create type public.transaction_type as enum ('expense', 'income', 'transfer');

create table public.transaction (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_centavos bigint not null check (amount_centavos > 0),
  type public.transaction_type not null,
  tag_id uuid references public.tag (id) on delete restrict,
  from_account_id uuid references public.account (id) on delete restrict,
  to_account_id uuid references public.account (id) on delete restrict,
  fee_centavos bigint,
  description text,
  date date not null,
  parent_transaction_id uuid references public.transaction (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tx_fee_positive check (fee_centavos is null or fee_centavos > 0),

  constraint tx_type_fields check (
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
  )
);

create index tx_user_date_idx on public.transaction (user_id, date desc, created_at desc);
create index tx_from_account_idx on public.transaction (from_account_id);
create index tx_to_account_idx on public.transaction (to_account_id);
create index tx_tag_idx on public.transaction (tag_id);
create index tx_parent_idx on public.transaction (parent_transaction_id);

-- Drop the non-negative balance CHECK: legitimate workflows (backfilled expense
-- before matching income, card-over-limit edits) require balances to float.
alter table public.account drop constraint account_balance_centavos_check;

-- RLS: owner-only, same pattern as prior slices.
alter table public.transaction enable row level security;
create policy transaction_select_own on public.transaction
  for select using (auth.uid() = user_id);
create policy transaction_insert_own on public.transaction
  for insert with check (auth.uid() = user_id);
create policy transaction_update_own on public.transaction
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transaction_delete_own on public.transaction
  for delete using (auth.uid() = user_id);

-- Reuse the generic touch_updated_at trigger from Slice 2.
create trigger transaction_touch_updated_at
  before update on public.transaction
  for each row execute function public.touch_updated_at();

-- Apply a single-account delta with the correct sign for the account's type.
-- Asset accounts (cash / e-wallet / savings / time-deposit) store positive
-- balances; money IN raises balance, money OUT lowers it.
-- Credit accounts store debt as positive; money IN (payment/refund) lowers
-- the debt, money OUT (purchase/cash-advance) raises it — so the sign flips.
create or replace function public.apply_account_delta(
  p_account_id uuid,
  p_amount_centavos bigint,
  p_money_in boolean
)
returns void
language plpgsql
as $$
declare
  v_type public.account_type;
  v_sign int;
begin
  if p_account_id is null then return; end if;
  select type into v_type from public.account where id = p_account_id;
  if v_type = 'credit' then
    v_sign := case when p_money_in then -1 else 1 end;
  else
    v_sign := case when p_money_in then 1 else -1 end;
  end if;
  update public.account
     set balance_centavos = balance_centavos + (v_sign * p_amount_centavos)
   where id = p_account_id;
end;
$$;

-- Balance delta: reverse `old`'s effect, apply `new`'s effect. Delegates to
-- apply_account_delta so credit vs. asset sign handling lives in one place.
create or replace function public.apply_transaction_balance_delta()
returns trigger
language plpgsql
as $$
begin
  -- Reverse old.
  if TG_OP = 'DELETE' or TG_OP = 'UPDATE' then
    if old.type = 'expense' then
      perform public.apply_account_delta(old.from_account_id, old.amount_centavos, true);
    elsif old.type = 'income' then
      perform public.apply_account_delta(old.to_account_id, old.amount_centavos, false);
    elsif old.type = 'transfer' then
      perform public.apply_account_delta(old.from_account_id, old.amount_centavos, true);
      perform public.apply_account_delta(old.to_account_id, old.amount_centavos, false);
    end if;
  end if;

  -- Apply new.
  if TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    if new.type = 'expense' then
      perform public.apply_account_delta(new.from_account_id, new.amount_centavos, false);
    elsif new.type = 'income' then
      perform public.apply_account_delta(new.to_account_id, new.amount_centavos, true);
    elsif new.type = 'transfer' then
      perform public.apply_account_delta(new.from_account_id, new.amount_centavos, false);
      perform public.apply_account_delta(new.to_account_id, new.amount_centavos, true);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger transaction_balance_delta
  after insert or update or delete on public.transaction
  for each row execute function public.apply_transaction_balance_delta();

-- Paired transfer-fees: keep a child expense row aligned with the parent's
-- fee / from_account / date. Seven UPDATE branches enumerated below.
create or replace function public.sync_paired_transfer_fee()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_fee_tag uuid;
  v_child   public.transaction%rowtype;
begin
  -- Children never spawn children; avoids trigger recursion.
  if coalesce(new.parent_transaction_id, old.parent_transaction_id) is not null then
    return coalesce(new, old);
  end if;

  select id into v_fee_tag
    from public.tag
   where user_id = coalesce(new.user_id, old.user_id)
     and name = 'transfer-fees'
     and is_system
   limit 1;

  if TG_OP = 'INSERT' then
    if new.type = 'transfer' and new.fee_centavos is not null then
      insert into public.transaction
        (user_id, amount_centavos, type, tag_id, from_account_id, date,
         description, parent_transaction_id)
      values
        (new.user_id, new.fee_centavos, 'expense', v_fee_tag, new.from_account_id,
         new.date, 'Transfer fee', new.id);
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  -- UPDATE: find the existing child (if any).
  select * into v_child
    from public.transaction
   where parent_transaction_id = new.id
   limit 1;

  -- Case 1: never a transfer on either side.
  if old.type <> 'transfer' and new.type <> 'transfer' then
    return new;
  end if;

  -- Case 2: transfer → non-transfer.
  if old.type = 'transfer' and new.type <> 'transfer' then
    if v_child.id is not null then
      delete from public.transaction where id = v_child.id;
    end if;
    return new;
  end if;

  -- Case 3: non-transfer → transfer.
  if old.type <> 'transfer' and new.type = 'transfer' then
    if new.fee_centavos is not null then
      insert into public.transaction
        (user_id, amount_centavos, type, tag_id, from_account_id, date,
         description, parent_transaction_id)
      values
        (new.user_id, new.fee_centavos, 'expense', v_fee_tag, new.from_account_id,
         new.date, 'Transfer fee', new.id);
    end if;
    return new;
  end if;

  -- From here: both old and new are 'transfer'.

  -- Case 4: fee NULL → X.
  if old.fee_centavos is null and new.fee_centavos is not null then
    insert into public.transaction
      (user_id, amount_centavos, type, tag_id, from_account_id, date,
       description, parent_transaction_id)
    values
      (new.user_id, new.fee_centavos, 'expense', v_fee_tag, new.from_account_id,
       new.date, 'Transfer fee', new.id);
    return new;
  end if;

  -- Case 5: fee X → NULL.
  if old.fee_centavos is not null and new.fee_centavos is null then
    if v_child.id is not null then
      delete from public.transaction where id = v_child.id;
    end if;
    return new;
  end if;

  -- Case 6: fee still set — sync amount / from_account / date.
  if v_child.id is not null and new.fee_centavos is not null then
    update public.transaction
       set amount_centavos = new.fee_centavos,
           from_account_id = new.from_account_id,
           date = new.date
     where id = v_child.id;
  end if;

  -- Case 7: both fees NULL, type still transfer — nothing to do.
  return new;
end;
$$;

create trigger transaction_sync_paired_fee
  after insert or update or delete on public.transaction
  for each row execute function public.sync_paired_transfer_fee();
