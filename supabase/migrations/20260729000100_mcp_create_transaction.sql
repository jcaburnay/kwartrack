-- Allow Kwartrack's approved ChatGPT integration to record one confirmed
-- receipt expense without opening general OAuth write access. Direct table
-- INSERT / UPDATE / DELETE remains blocked by the restrictive OAuth policies.

create table public.mcp_transaction_request (
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  transaction_id uuid not null references public.transaction (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

alter table public.mcp_transaction_request enable row level security;

-- No direct table policies are intentional. Callers can only use the narrowly
-- validated SECURITY DEFINER function below.
revoke all on table public.mcp_transaction_request from public, anon, authenticated;

create or replace function public.mcp_create_expense(
  p_idempotency_key uuid,
  p_amount_centavos bigint,
  p_date date,
  p_account_name text,
  p_tag_name text,
  p_description text default null
)
returns table (
  was_duplicate boolean,
  amount_centavos bigint,
  transaction_date date,
  transaction_description text,
  account_name text,
  tag_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_ids uuid[];
  v_account_names text[];
  v_tag_ids uuid[];
  v_tag_names text[];
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_approved_data_reader() then
    raise exception 'This OAuth client is not approved' using errcode = 'insufficient_privilege';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = 'invalid_parameter_value';
  end if;

  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = 'check_violation';
  end if;

  if p_date is null then
    raise exception 'Transaction date is required' using errcode = 'not_null_violation';
  end if;

  if length(trim(coalesce(p_account_name, ''))) not between 1 and 50 then
    raise exception 'Account name must be 1 to 50 characters'
      using errcode = 'invalid_parameter_value';
  end if;

  if length(trim(coalesce(p_tag_name, ''))) not between 1 and 50 then
    raise exception 'Tag name must be 1 to 50 characters'
      using errcode = 'invalid_parameter_value';
  end if;

  if length(coalesce(p_description, '')) > 200 then
    raise exception 'Description must be 200 characters or fewer'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Serialize retries for the same user/key so only one ledger row is created.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select request.transaction_id
    into v_transaction_id
    from public.mcp_transaction_request as request
   where request.user_id = v_user_id
     and request.idempotency_key = p_idempotency_key;

  if v_transaction_id is not null then
    return query
      select
        true,
        tx.amount_centavos,
        tx.date,
        tx.description,
        account.name,
        tag.name
      from public.transaction as tx
      join public.account as account on account.id = tx.from_account_id
      join public.tag as tag on tag.id = tx.tag_id
      where tx.id = v_transaction_id
        and tx.user_id = v_user_id;
    return;
  end if;

  select array_agg(account.id), array_agg(account.name)
    into v_account_ids, v_account_names
    from public.account as account
   where account.user_id = v_user_id
     and lower(account.name) = lower(trim(p_account_name))
     and not account.is_archived;

  if coalesce(cardinality(v_account_ids), 0) = 0 then
    raise exception 'Active account "%" was not found', trim(p_account_name)
      using errcode = 'invalid_parameter_value';
  end if;
  if cardinality(v_account_ids) > 1 then
    raise exception 'Account name "%" is ambiguous', trim(p_account_name)
      using errcode = 'invalid_parameter_value';
  end if;

  select array_agg(tag.id), array_agg(tag.name)
    into v_tag_ids, v_tag_names
    from public.tag as tag
   where tag.user_id = v_user_id
     and lower(tag.name) = lower(trim(p_tag_name))
     and tag.type = 'expense'
     and not tag.is_system;

  if coalesce(cardinality(v_tag_ids), 0) = 0 then
    raise exception 'Expense tag "%" was not found', trim(p_tag_name)
      using errcode = 'invalid_parameter_value';
  end if;
  if cardinality(v_tag_ids) > 1 then
    raise exception 'Expense tag name "%" is ambiguous', trim(p_tag_name)
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.transaction (
    user_id,
    amount_centavos,
    type,
    tag_id,
    from_account_id,
    description,
    date
  )
  values (
    v_user_id,
    p_amount_centavos,
    'expense',
    v_tag_ids[1],
    v_account_ids[1],
    nullif(trim(coalesce(p_description, '')), ''),
    p_date
  )
  returning id into v_transaction_id;

  insert into public.mcp_transaction_request (user_id, idempotency_key, transaction_id)
  values (v_user_id, p_idempotency_key, v_transaction_id);

  return query
    select
      false,
      tx.amount_centavos,
      tx.date,
      tx.description,
      v_account_names[1],
      v_tag_names[1]
    from public.transaction as tx
    where tx.id = v_transaction_id;
end;
$$;

revoke all on function public.mcp_create_expense(uuid, bigint, date, text, text, text)
  from public, anon;
grant execute on function public.mcp_create_expense(uuid, bigint, date, text, text, text)
  to authenticated;

comment on function public.mcp_create_expense(uuid, bigint, date, text, text, text) is
  'Records one idempotent receipt expense for the signed-in user after resolving an active account and expense tag by name.';
