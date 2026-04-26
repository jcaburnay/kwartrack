-- Slice 9: Debts & Splits.
-- Adds person + split_event + split_participant + debt tables, FK columns on
-- transaction (split_id / debt_id), helper functions, six triggers, and three
-- RPCs (create_split / update_split / settle_debt).
--
-- The auto-ledger pipeline:
--   - INSERT split_event -> trigger creates the auto-expense (split_id FK).
--   - INSERT/UPDATE/DELETE split_participant -> trigger recomputes the
--     denormalized split_event.user_share_centavos.
--   - UPDATE split_event -> trigger propagates total/account/tag/date/desc to
--     the linked auto-expense.
--   - DELETE split_event -> trigger orchestrates: deletes auto-expense, then
--     FK CASCADE deletes child debts; debt_before_delete fires per child to
--     orphan-retag any settlement transactions.
--   - DELETE debt -> trigger preserves settlement-tagged transactions
--     (debt_id := NULL, tag := debt-settlement-orphan), deletes any creation tx.
--   - DELETE transaction directly (with split_id or debt_id set) -> blocked
--     unless app.allow_auto_tx_delete is set in the current transaction.

create type public.split_method as enum ('equal', 'exact', 'percentage', 'shares');
create type public.debt_direction as enum ('loaned', 'owed');

create table public.person (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index person_user_idx on public.person (user_id);

alter table public.person enable row level security;
create policy person_select_own on public.person
  for select using (auth.uid() = user_id);
create policy person_insert_own on public.person
  for insert with check (auth.uid() = user_id);
create policy person_update_own on public.person
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy person_delete_own on public.person
  for delete using (auth.uid() = user_id);

create table public.split_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (length(description) between 1 and 200),
  total_centavos bigint not null check (total_centavos > 0),
  date date not null,
  paid_from_account_id uuid not null references public.account (id) on delete restrict,
  tag_id uuid not null references public.tag (id) on delete restrict,
  method public.split_method not null,
  user_share_centavos bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index split_event_user_date_idx on public.split_event (user_id, date desc);
create index split_event_tag_idx on public.split_event (tag_id);
create index split_event_account_idx on public.split_event (paid_from_account_id);

alter table public.split_event enable row level security;
create policy split_event_select_own on public.split_event
  for select using (auth.uid() = user_id);
create policy split_event_insert_own on public.split_event
  for insert with check (auth.uid() = user_id);
create policy split_event_update_own on public.split_event
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy split_event_delete_own on public.split_event
  for delete using (auth.uid() = user_id);

create trigger split_event_touch_updated_at
  before update on public.split_event
  for each row execute function public.touch_updated_at();

create table public.split_participant (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.split_event (id) on delete cascade,
  person_id uuid not null references public.person (id) on delete restrict,
  share_centavos bigint not null check (share_centavos >= 0),
  share_input_value numeric,
  unique (split_id, person_id)
);
create index split_participant_split_idx on public.split_participant (split_id);
create index split_participant_person_idx on public.split_participant (person_id);

-- RLS via the parent split's user_id. We could store user_id directly, but the
-- parent FK + cascade keeps the schema tighter.
alter table public.split_participant enable row level security;
create policy split_participant_select_own on public.split_participant
  for select using (
    exists (select 1 from public.split_event s
             where s.id = split_id and s.user_id = auth.uid()));
create policy split_participant_insert_own on public.split_participant
  for insert with check (
    exists (select 1 from public.split_event s
             where s.id = split_id and s.user_id = auth.uid()));
create policy split_participant_update_own on public.split_participant
  for update using (
    exists (select 1 from public.split_event s
             where s.id = split_id and s.user_id = auth.uid()))
   with check (
    exists (select 1 from public.split_event s
             where s.id = split_id and s.user_id = auth.uid()));
create policy split_participant_delete_own on public.split_participant
  for delete using (
    exists (select 1 from public.split_event s
             where s.id = split_id and s.user_id = auth.uid()));

create table public.debt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null references public.person (id) on delete restrict,
  split_id uuid references public.split_event (id) on delete cascade,
  participant_id uuid references public.split_participant (id) on delete cascade,
  direction public.debt_direction not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  settled_centavos bigint not null default 0 check (settled_centavos >= 0),
  tag_id uuid references public.tag (id) on delete restrict,
  paid_account_id uuid references public.account (id) on delete restrict,
  date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint debt_settled_le_amount check (settled_centavos <= amount_centavos),
  constraint debt_split_participant_paired
    check ((split_id is null) = (participant_id is null)),
  constraint debt_split_derived_no_own_tag
    check (split_id is null or tag_id is null),
  constraint debt_standalone_account_requires_tag
    check (split_id is not null or paid_account_id is null or tag_id is not null)
);
create index debt_user_idx on public.debt (user_id);
create index debt_person_idx on public.debt (person_id);
create index debt_split_idx on public.debt (split_id);
create index debt_unsettled_loaned_idx on public.debt (user_id)
  where direction = 'loaned' and settled_centavos < amount_centavos;

alter table public.debt enable row level security;
create policy debt_select_own on public.debt
  for select using (auth.uid() = user_id);
create policy debt_insert_own on public.debt
  for insert with check (auth.uid() = user_id);
create policy debt_update_own on public.debt
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy debt_delete_own on public.debt
  for delete using (auth.uid() = user_id);

create trigger debt_touch_updated_at
  before update on public.debt
  for each row execute function public.touch_updated_at();

-- Transaction FK columns: SET NULL on parent delete because BEFORE DELETE
-- triggers on split_event/debt orchestrate "what to keep vs. delete" before
-- the FK clause kicks in. The FKs are belt-and-suspenders.
alter table public.transaction
  add column split_id uuid references public.split_event (id) on delete set null,
  add column debt_id  uuid references public.debt (id) on delete set null;
create index tx_split_idx on public.transaction (split_id) where split_id is not null;
create index tx_debt_idx  on public.transaction (debt_id)  where debt_id is not null;

-- Recompute the denormalized user_share_centavos for a split. Fired both
-- when split_event.total_centavos changes and when participants change.
create or replace function public.recompute_split_user_share(p_split_id uuid)
returns void
language plpgsql
as $$
begin
  update public.split_event
     set user_share_centavos = total_centavos -
           coalesce(
             (select sum(share_centavos) from public.split_participant
               where split_id = p_split_id), 0),
         updated_at = now()
   where id = p_split_id;
end;
$$;

-- Wire on split_event.total_centavos UPDATE.
create or replace function public.split_event_recompute_share()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_split_user_share(new.id);
  return null;
end;
$$;

create trigger split_event_recompute_share_trg
  after insert on public.split_event
  for each row execute function public.split_event_recompute_share();

create trigger split_event_recompute_share_on_total_trg
  after update of total_centavos on public.split_event
  for each row execute function public.split_event_recompute_share();

-- Wire on split_participant changes.
create or replace function public.split_participant_recompute_parent()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_split_user_share(coalesce(new.split_id, old.split_id));
  return null;
end;
$$;

create trigger split_participant_recompute_share_trg
  after insert or update or delete on public.split_participant
  for each row execute function public.split_participant_recompute_parent();

-- Sync auto-expense on split_event create + propagate edits.
create or replace function public.split_event_sync_auto_expense()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.transaction
      (user_id, type, from_account_id, tag_id, amount_centavos, date,
       description, split_id)
    values
      (new.user_id, 'expense', new.paid_from_account_id, new.tag_id,
       new.total_centavos, new.date, new.description, new.id);
    return new;
  end if;

  -- UPDATE: propagate any field that affects the auto-expense.
  if old.total_centavos       is distinct from new.total_centavos
     or old.paid_from_account_id is distinct from new.paid_from_account_id
     or old.tag_id              is distinct from new.tag_id
     or old.date                is distinct from new.date
     or old.description         is distinct from new.description then
    update public.transaction
       set amount_centavos = new.total_centavos,
           from_account_id = new.paid_from_account_id,
           tag_id          = new.tag_id,
           date            = new.date,
           description     = new.description
     where split_id = new.id;
  end if;

  return new;
end;
$$;

create trigger split_event_sync_auto_expense_trg
  after insert or update on public.split_event
  for each row execute function public.split_event_sync_auto_expense();

-- Standalone debt creation-tx: only fires for split_id IS NULL with a
-- paid_account_id. The CHECK on debt guarantees tag_id is non-null in this
-- branch.
create or replace function public.debt_create_creation_tx()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.split_id is null and new.paid_account_id is not null then
    if new.direction = 'loaned' then
      insert into public.transaction
        (user_id, type, from_account_id, tag_id, amount_centavos, date,
         description, debt_id)
      values
        (new.user_id, 'expense', new.paid_account_id, new.tag_id,
         new.amount_centavos, new.date, new.description, new.id);
    else
      insert into public.transaction
        (user_id, type, to_account_id, tag_id, amount_centavos, date,
         description, debt_id)
      values
        (new.user_id, 'income', new.paid_account_id, new.tag_id,
         new.amount_centavos, new.date, new.description, new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger debt_create_creation_tx_trg
  after insert on public.debt
  for each row execute function public.debt_create_creation_tx();

-- Direct delete guard on transaction. Bypassed when the session-local config
-- flag app.allow_auto_tx_delete = 'true' is set by parent BEFORE DELETE
-- triggers. Local-scoped config persists for the entire transaction.
create or replace function public.transaction_before_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if (old.split_id is not null or old.debt_id is not null)
     and coalesce(current_setting('app.allow_auto_tx_delete', true), 'false') <> 'true' then
    raise exception
      'This transaction is tied to a split/debt. Delete the split/debt itself to remove it.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger transaction_before_delete_guard_trg
  before delete on public.transaction
  for each row execute function public.transaction_before_delete_guard();

-- BEFORE DELETE on debt: orphan-retag settlement transactions, then delete the
-- creation tx if any. The order matters: the UPDATE clears debt_id from
-- settlement rows first, so the subsequent DELETE only matches the creation
-- tx.
create or replace function public.debt_before_delete_orphan_retag()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_settlement_tag uuid;
  v_orphan_tag uuid;
begin
  perform set_config('app.allow_auto_tx_delete', 'true', true);

  select id into v_settlement_tag
    from public.tag
   where user_id = old.user_id and name = 'debt-settlement' and is_system
   limit 1;
  select id into v_orphan_tag
    from public.tag
   where user_id = old.user_id and name = 'debt-settlement-orphan' and is_system
   limit 1;

  -- Preserve settlement transactions: clear debt_id, retag to orphan.
  update public.transaction
     set debt_id = null,
         tag_id  = v_orphan_tag
   where debt_id = old.id
     and tag_id  = v_settlement_tag;

  -- Delete any creation-tx (its tag_id was the debt's own tag, not
  -- debt-settlement, so it survived the UPDATE above).
  delete from public.transaction
   where debt_id = old.id;

  return old;
end;
$$;

create trigger debt_before_delete_trg
  before delete on public.debt
  for each row execute function public.debt_before_delete_orphan_retag();

-- BEFORE DELETE on split_event: open the bypass flag, delete the auto-expense.
-- FK CASCADE then handles split_participant + debt children (the
-- debt_before_delete_trg above fires per child).
create or replace function public.split_event_before_delete_cascade()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform set_config('app.allow_auto_tx_delete', 'true', true);
  delete from public.transaction where split_id = old.id;
  return old;
end;
$$;

create trigger split_event_before_delete_trg
  before delete on public.split_event
  for each row execute function public.split_event_before_delete_cascade();

-- create_split: atomic split_event + N split_participant + N debt insert.
-- The split_event_sync_auto_expense trigger handles the auto-expense; the
-- recompute trigger maintains user_share_centavos.
create or replace function public.create_split(
  p_description text,
  p_total_centavos bigint,
  p_date date,
  p_paid_from_account_id uuid,
  p_tag_id uuid,
  p_method public.split_method,
  p_participants jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_split_id uuid;
  rec record;
  v_participant_id uuid;
begin
  if v_user is null then raise exception 'Not signed in'; end if;

  insert into public.split_event
    (user_id, description, total_centavos, date, paid_from_account_id,
     tag_id, method)
  values
    (v_user, p_description, p_total_centavos, p_date, p_paid_from_account_id,
     p_tag_id, p_method)
  returning id into v_split_id;

  -- p_participants shape: [{ person_id, share_centavos, share_input_value }]
  for rec in
    select (e ->> 'person_id')::uuid as person_id,
           (e ->> 'share_centavos')::bigint as share_centavos,
           nullif(e ->> 'share_input_value', '')::numeric as share_input_value
      from jsonb_array_elements(p_participants) as e
  loop
    insert into public.split_participant
      (split_id, person_id, share_centavos, share_input_value)
    values
      (v_split_id, rec.person_id, rec.share_centavos, rec.share_input_value)
    returning id into v_participant_id;

    insert into public.debt
      (user_id, person_id, split_id, participant_id, direction,
       amount_centavos, date, description)
    values
      (v_user, rec.person_id, v_split_id, v_participant_id, 'loaned',
       rec.share_centavos, p_date, p_description);
  end loop;

  return v_split_id;
end;
$$;

-- update_split: reconciles the split_event + participants + debts. Existing
-- debts' settled_centavos is preserved; the CHECK (settled <= amount) catches
-- "lower share below settled" errors. Removed participants delete via
-- CASCADE through split_participant; the debt_before_delete trigger
-- orphan-retags any settlement rows.
create or replace function public.update_split(
  p_split_id uuid,
  p_description text,
  p_total_centavos bigint,
  p_date date,
  p_paid_from_account_id uuid,
  p_tag_id uuid,
  p_method public.split_method,
  p_participants jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_existing_user uuid;
  rec record;
  v_keep_person_ids uuid[] := '{}';
  v_participant_id uuid;
begin
  if v_user is null then raise exception 'Not signed in'; end if;

  select user_id into v_existing_user from public.split_event where id = p_split_id;
  if v_existing_user is null or v_existing_user <> v_user then
    raise exception 'Split not found';
  end if;

  update public.split_event set
    description = p_description,
    total_centavos = p_total_centavos,
    date = p_date,
    paid_from_account_id = p_paid_from_account_id,
    tag_id = p_tag_id,
    method = p_method
  where id = p_split_id;

  for rec in
    select (e ->> 'person_id')::uuid as person_id,
           (e ->> 'share_centavos')::bigint as share_centavos,
           nullif(e ->> 'share_input_value', '')::numeric as share_input_value
      from jsonb_array_elements(p_participants) as e
  loop
    v_keep_person_ids := array_append(v_keep_person_ids, rec.person_id);

    select id into v_participant_id
      from public.split_participant
     where split_id = p_split_id and person_id = rec.person_id;

    if v_participant_id is not null then
      update public.split_participant set
        share_centavos = rec.share_centavos,
        share_input_value = rec.share_input_value
      where id = v_participant_id;
      update public.debt set
        amount_centavos = rec.share_centavos,
        date = p_date,
        description = p_description
      where participant_id = v_participant_id;
    else
      insert into public.split_participant
        (split_id, person_id, share_centavos, share_input_value)
      values
        (p_split_id, rec.person_id, rec.share_centavos, rec.share_input_value)
      returning id into v_participant_id;
      insert into public.debt
        (user_id, person_id, split_id, participant_id, direction,
         amount_centavos, date, description)
      values
        (v_user, rec.person_id, p_split_id, v_participant_id, 'loaned',
         rec.share_centavos, p_date, p_description);
    end if;
  end loop;

  -- Remove participants no longer in the list. Cascade-delete through
  -- split_participant -> debt fires the orphan-retag trigger.
  delete from public.split_participant
   where split_id = p_split_id
     and person_id <> all (v_keep_person_ids);
end;
$$;

-- settle_debt: insert one settlement transaction, increment settled_centavos.
create or replace function public.settle_debt(
  p_debt_id uuid,
  p_amount_centavos bigint,
  p_paid_account_id uuid,
  p_date date default current_date
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_debt public.debt%rowtype;
  v_settle_tag uuid;
  v_tx_id uuid;
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  if p_amount_centavos <= 0 then raise exception 'Amount must be greater than 0'; end if;

  select * into v_debt from public.debt where id = p_debt_id and user_id = v_user for update;
  if not found then raise exception 'Debt not found'; end if;
  if v_debt.settled_centavos + p_amount_centavos > v_debt.amount_centavos then
    raise exception 'Settlement would exceed debt amount';
  end if;

  select id into v_settle_tag
    from public.tag
   where user_id = v_user and name = 'debt-settlement' and is_system
   limit 1;
  if v_settle_tag is null then
    raise exception 'debt-settlement system tag missing';
  end if;

  if v_debt.direction = 'loaned' then
    insert into public.transaction
      (user_id, type, to_account_id, tag_id, amount_centavos, date, debt_id)
    values
      (v_user, 'income', p_paid_account_id, v_settle_tag, p_amount_centavos,
       p_date, p_debt_id)
    returning id into v_tx_id;
  else
    insert into public.transaction
      (user_id, type, from_account_id, tag_id, amount_centavos, date, debt_id)
    values
      (v_user, 'expense', p_paid_account_id, v_settle_tag, p_amount_centavos,
       p_date, p_debt_id)
    returning id into v_tx_id;
  end if;

  update public.debt
     set settled_centavos = settled_centavos + p_amount_centavos
   where id = p_debt_id;

  return v_tx_id;
end;
$$;
