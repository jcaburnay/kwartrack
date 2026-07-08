-- Support creating a time deposit funded from an existing asset account.
--
-- External/already-funded time deposits keep the historical behavior:
-- initial_balance_centavos = principal_centavos, so the opening balance is the
-- deposit principal. Internally funded time deposits start at zero and receive
-- the principal through a transfer transaction in the same database transaction.

alter table public.account drop constraint if exists account_type_fields_match;

alter table public.account add constraint account_type_fields_match check (
  (type = 'credit' and
     credit_limit_centavos is not null and credit_limit_centavos > 0 and
     principal_centavos is null and interest_rate_bps is null and
     maturity_date is null and interest_posting_interval is null)
  or
  (type = 'time-deposit' and
     principal_centavos is not null and principal_centavos > 0 and
     interest_rate_bps is not null and interest_rate_bps > 0 and
     maturity_date is not null and
     interest_posting_interval is not null and
     initial_balance_centavos in (0, principal_centavos) and
     credit_limit_centavos is null)
  or
  (type in ('cash', 'e-wallet', 'savings') and
     credit_limit_centavos is null and
     principal_centavos is null and interest_rate_bps is null and
     maturity_date is null and interest_posting_interval is null)
);

create or replace function public.create_time_deposit(
  p_name text,
  p_principal_centavos bigint,
  p_interest_rate_bps int,
  p_maturity_date date,
  p_interest_posting_interval public.posting_interval,
  p_group_id uuid default null,
  p_funding_account_id uuid default null,
  p_funding_date date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_td_id uuid;
  v_source record;
  v_trimmed_name text := trim(coalesce(p_name, ''));
  v_initial_balance bigint;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  if length(v_trimmed_name) < 1 or length(v_trimmed_name) > 50 then
    raise exception 'Name must be 1 to 50 characters'
      using errcode = 'check_violation';
  end if;

  if p_principal_centavos is null or p_principal_centavos <= 0 then
    raise exception 'Principal must be greater than 0'
      using errcode = 'check_violation';
  end if;

  if p_interest_rate_bps is null or p_interest_rate_bps <= 0 then
    raise exception 'Interest rate must be greater than 0'
      using errcode = 'check_violation';
  end if;

  if p_maturity_date is null or p_maturity_date <= current_date then
    raise exception 'Maturity date must be in the future'
      using errcode = 'check_violation';
  end if;

  if p_interest_posting_interval is null then
    raise exception 'Interest posting interval is required'
      using errcode = 'check_violation';
  end if;

  if p_funding_account_id is not null then
    select id, type, balance_centavos, is_archived
      into v_source
      from public.account
     where id = p_funding_account_id
       and user_id = v_user_id
     for update;

    if not found then
      raise exception 'Funding account must be owned by this user'
        using errcode = 'check_violation';
    end if;

    if v_source.is_archived then
      raise exception 'Funding account is archived'
        using errcode = 'check_violation';
    end if;

    if v_source.type not in ('cash', 'e-wallet', 'savings') then
      raise exception 'Funding account must be cash, e-wallet, or savings'
        using errcode = 'check_violation';
    end if;

    if v_source.balance_centavos < p_principal_centavos then
      raise exception 'Funding account has insufficient balance'
        using errcode = 'check_violation';
    end if;
  end if;

  v_initial_balance := case
    when p_funding_account_id is null then p_principal_centavos
    else 0
  end;

  insert into public.account (
    user_id,
    name,
    type,
    initial_balance_centavos,
    principal_centavos,
    interest_rate_bps,
    maturity_date,
    interest_posting_interval,
    group_id
  ) values (
    v_user_id,
    v_trimmed_name,
    'time-deposit',
    v_initial_balance,
    p_principal_centavos,
    p_interest_rate_bps,
    p_maturity_date,
    p_interest_posting_interval,
    p_group_id
  )
  returning id into v_td_id;

  if p_funding_account_id is not null then
    insert into public.transaction (
      user_id,
      amount_centavos,
      type,
      from_account_id,
      to_account_id,
      description,
      date
    ) values (
      v_user_id,
      p_principal_centavos,
      'transfer',
      p_funding_account_id,
      v_td_id,
      'Fund ' || v_trimmed_name,
      coalesce(p_funding_date, current_date)
    );
  end if;

  return v_td_id;
end;
$$;

revoke execute on function public.create_time_deposit(
  text,
  bigint,
  int,
  date,
  public.posting_interval,
  uuid,
  uuid,
  date
) from public, anon;

grant execute on function public.create_time_deposit(
  text,
  bigint,
  int,
  date,
  public.posting_interval,
  uuid,
  uuid,
  date
) to authenticated;
