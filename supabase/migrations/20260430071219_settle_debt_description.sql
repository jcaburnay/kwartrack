-- Auto-fill the settlement transaction's description with the counter-party
-- so the Transactions panel shows context (e.g. "Payment from Alice") instead
-- of an empty cell.

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
  v_person_name text;
  v_description text;
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

  select name into v_person_name from public.person where id = v_debt.person_id;
  v_description := case v_debt.direction
    when 'loaned' then 'Payment from ' || coalesce(v_person_name, 'counter-party')
    else 'Payment to ' || coalesce(v_person_name, 'counter-party')
  end;

  if v_debt.direction = 'loaned' then
    insert into public.transaction
      (user_id, type, to_account_id, tag_id, amount_centavos, date, debt_id, description)
    values
      (v_user, 'income', p_paid_account_id, v_settle_tag, p_amount_centavos,
       p_date, p_debt_id, v_description)
    returning id into v_tx_id;
  else
    insert into public.transaction
      (user_id, type, from_account_id, tag_id, amount_centavos, date, debt_id, description)
    values
      (v_user, 'expense', p_paid_account_id, v_settle_tag, p_amount_centavos,
       p_date, p_debt_id, v_description)
    returning id into v_tx_id;
  end if;

  update public.debt
     set settled_centavos = settled_centavos + p_amount_centavos
   where id = p_debt_id;

  return v_tx_id;
end;
$$;
