-- Harden ledger and tenant-boundary integrity.
--
-- RLS correctly limits which top-level rows a user can read/write, but plain
-- foreign keys do not prove referenced rows belong to the same user. These
-- triggers enforce same-user references at the database boundary, including
-- SECURITY DEFINER trigger paths and service-role writes.
--
-- account.balance_centavos is also derived ledger state. Clients must adjust it
-- only by inserting/updating/deleting transactions; direct account updates are
-- blocked unless the ledger trigger opens a transaction-local guard.

-- Small ownership helpers ----------------------------------------------------

create or replace function public.assert_account_owned(
  p_account_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
stable
as $$
begin
  if p_account_id is null then return; end if;
  if not exists (
    select 1 from public.account
     where id = p_account_id and user_id = p_user_id
  ) then
    raise exception '% must be owned by this same user', p_label
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.assert_tag_owned(
  p_tag_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
stable
as $$
begin
  if p_tag_id is null then return; end if;
  if not exists (
    select 1 from public.tag
     where id = p_tag_id and user_id = p_user_id
  ) then
    raise exception '% must be owned by this same user', p_label
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.assert_person_owned(
  p_person_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
stable
as $$
begin
  if p_person_id is null then return; end if;
  if not exists (
    select 1 from public.person
     where id = p_person_id and user_id = p_user_id
  ) then
    raise exception '% must be owned by this same user', p_label
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.assert_split_owned(
  p_split_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
stable
as $$
begin
  if p_split_id is null then return; end if;
  if not exists (
    select 1 from public.split_event
     where id = p_split_id and user_id = p_user_id
  ) then
    raise exception '% must be owned by this same user', p_label
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.assert_debt_owned(
  p_debt_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
stable
as $$
begin
  if p_debt_id is null then return; end if;
  if not exists (
    select 1 from public.debt
     where id = p_debt_id and user_id = p_user_id
  ) then
    raise exception '% must be owned by this same user', p_label
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.assert_recurring_owned(
  p_recurring_id uuid,
  p_user_id uuid,
  p_label text
)
returns void
language plpgsql
stable
as $$
begin
  if p_recurring_id is null then return; end if;
  if not exists (
    select 1 from public.recurring
     where id = p_recurring_id and user_id = p_user_id
  ) then
    raise exception '% must be owned by this same user', p_label
      using errcode = 'check_violation';
  end if;
end;
$$;

-- account --------------------------------------------------------------------

create or replace function public.account_protect_balance_update()
returns trigger
language plpgsql
as $$
begin
  if new.balance_centavos is distinct from old.balance_centavos and
     coalesce(current_setting('app.allow_account_balance_update', true), 'false') <> 'true' then
    raise exception 'Account balance is ledger-managed; record a transaction instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists account_protect_balance_update_trg on public.account;
create trigger account_protect_balance_update_trg
  before update of balance_centavos on public.account
  for each row execute function public.account_protect_balance_update();

create or replace function public.account_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is not null and not exists (
    select 1 from public.account_group
     where id = new.group_id and user_id = new.user_id
  ) then
    raise exception 'Account group must be owned by this same user'
      using errcode = 'check_violation';
  end if;

  perform public.assert_recurring_owned(
    new.interest_recurring_id,
    new.user_id,
    'Interest recurring'
  );

  return new;
end;
$$;

drop trigger if exists account_validate_owned_refs_trg on public.account;
create trigger account_validate_owned_refs_trg
  before insert or update of user_id, group_id, interest_recurring_id on public.account
  for each row execute function public.account_validate_owned_refs();

-- transactions ---------------------------------------------------------------

create or replace function public.transaction_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_tag_owned(new.tag_id, new.user_id, 'Transaction tag');
  perform public.assert_account_owned(new.from_account_id, new.user_id, 'From account');
  perform public.assert_account_owned(new.to_account_id, new.user_id, 'To account');
  perform public.assert_recurring_owned(new.recurring_id, new.user_id, 'Recurring');
  perform public.assert_split_owned(new.split_id, new.user_id, 'Split');
  perform public.assert_debt_owned(new.debt_id, new.user_id, 'Debt');

  if new.parent_transaction_id is not null and not exists (
    select 1 from public.transaction
     where id = new.parent_transaction_id and user_id = new.user_id
  ) then
    raise exception 'Parent transaction must be owned by this same user'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists transaction_validate_owned_refs_trg on public.transaction;
create trigger transaction_validate_owned_refs_trg
  before insert or update of user_id, tag_id, from_account_id, to_account_id,
    recurring_id, split_id, debt_id, parent_transaction_id on public.transaction
  for each row execute function public.transaction_validate_owned_refs();

-- Recreate balance delta writer so only this trigger path can mutate balances.
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

  perform set_config('app.allow_account_balance_update', 'true', true);
  update public.account
     set balance_centavos = balance_centavos + (v_sign * p_amount_centavos)
   where id = p_account_id;
  perform set_config('app.allow_account_balance_update', 'false', true);
end;
$$;

-- recurring ------------------------------------------------------------------

create or replace function public.recurring_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_tag_owned(new.tag_id, new.user_id, 'Recurring tag');
  perform public.assert_account_owned(new.from_account_id, new.user_id, 'From account');
  perform public.assert_account_owned(new.to_account_id, new.user_id, 'To account');
  return new;
end;
$$;

drop trigger if exists recurring_validate_owned_refs_trg on public.recurring;
create trigger recurring_validate_owned_refs_trg
  before insert or update of user_id, tag_id, from_account_id, to_account_id on public.recurring
  for each row execute function public.recurring_validate_owned_refs();

-- budget ---------------------------------------------------------------------

create or replace function public.budget_allocation_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_tag_owned(new.tag_id, new.user_id, 'Budget allocation tag');
  return new;
end;
$$;

drop trigger if exists budget_allocation_validate_owned_refs_trg on public.budget_allocation;
create trigger budget_allocation_validate_owned_refs_trg
  before insert or update of user_id, tag_id on public.budget_allocation
  for each row execute function public.budget_allocation_validate_owned_refs();

-- debts and splits -----------------------------------------------------------

create or replace function public.split_event_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_account_owned(new.paid_from_account_id, new.user_id, 'Paid-from account');
  perform public.assert_tag_owned(new.tag_id, new.user_id, 'Split tag');
  return new;
end;
$$;

drop trigger if exists split_event_validate_owned_refs_trg on public.split_event;
create trigger split_event_validate_owned_refs_trg
  before insert or update of user_id, paid_from_account_id, tag_id on public.split_event
  for each row execute function public.split_event_validate_owned_refs();

create or replace function public.split_participant_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.split_event s
      join public.person p on p.id = new.person_id
     where s.id = new.split_id
       and p.user_id = s.user_id
  ) then
    raise exception 'Split participant person must be owned by this same user'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists split_participant_validate_owned_refs_trg on public.split_participant;
create trigger split_participant_validate_owned_refs_trg
  before insert or update of split_id, person_id on public.split_participant
  for each row execute function public.split_participant_validate_owned_refs();

create or replace function public.debt_validate_owned_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_person_owned(new.person_id, new.user_id, 'Debt person');
  perform public.assert_split_owned(new.split_id, new.user_id, 'Split');
  perform public.assert_tag_owned(new.tag_id, new.user_id, 'Debt tag');
  perform public.assert_account_owned(new.paid_account_id, new.user_id, 'Paid account');

  if new.participant_id is not null and not exists (
    select 1
      from public.split_participant sp
      join public.split_event s on s.id = sp.split_id
     where sp.id = new.participant_id
       and sp.split_id = new.split_id
       and sp.person_id = new.person_id
       and s.user_id = new.user_id
  ) then
    raise exception 'Debt participant must belong to the same split, person, and user'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists debt_validate_owned_refs_trg on public.debt;
create trigger debt_validate_owned_refs_trg
  before insert or update of user_id, person_id, split_id, participant_id,
    tag_id, paid_account_id on public.debt
  for each row execute function public.debt_validate_owned_refs();

-- Helper functions are implementation details for triggers, not public RPCs.
revoke execute on function public.assert_account_owned(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.assert_tag_owned(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.assert_person_owned(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.assert_split_owned(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.assert_debt_owned(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.assert_recurring_owned(uuid, uuid, text) from public, anon, authenticated;
