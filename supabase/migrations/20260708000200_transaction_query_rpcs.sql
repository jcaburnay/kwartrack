-- Server-side transaction queries for the Accounts panel.
--
-- The app previously fetched every top-level transaction, then filtered,
-- searched, sorted, and counted in the browser. These RPCs keep the same
-- user-visible rules while letting Postgres do the heavy work and return a
-- page plus aggregate summaries.

create or replace function public.transaction_list(
  p_type public.transaction_type default null,
  p_tag_id uuid default null,
  p_account_id uuid default null,
  p_group_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_split_id uuid default null,
  p_debt_id uuid default null,
  p_search text default '',
  p_sort_key text default 'date',
  p_sort_dir text default 'desc',
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  amount_centavos bigint,
  type public.transaction_type,
  tag_id uuid,
  from_account_id uuid,
  to_account_id uuid,
  fee_centavos bigint,
  description text,
  date date,
  parent_transaction_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  recurring_id uuid,
  split_id uuid,
  debt_id uuid,
  is_installment_portion boolean,
  recurring_service text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_like text;
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_sort_key text := case
    when p_sort_key in ('date', 'amount', 'tag', 'account') then p_sort_key
    else 'date'
  end;
  v_sort_dir text := case
    when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if v_search is not null then
    v_like := '%' ||
      replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') ||
      '%';
  end if;

  return query
  with filtered as (
    select
      t.id,
      t.user_id,
      t.amount_centavos,
      t.type,
      t.tag_id,
      t.from_account_id,
      t.to_account_id,
      t.fee_centavos,
      t.description,
      t.date,
      t.parent_transaction_id,
      t.created_at,
      t.updated_at,
      t.recurring_id,
      t.split_id,
      t.debt_id,
      t.is_installment_portion,
      r.service as recurring_service,
      coalesce(tag.name, '') as tag_sort_name,
      case
        when t.type = 'expense' then coalesce(from_account.name, '')
        when t.type = 'income' then coalesce(to_account.name, '')
        else coalesce(from_account.name, '') || ' → ' || coalesce(to_account.name, '')
      end as account_sort_name
    from public.transaction t
    left join public.recurring r on r.id = t.recurring_id and r.user_id = t.user_id
    left join public.tag tag on tag.id = t.tag_id and tag.user_id = t.user_id
    left join public.account from_account
      on from_account.id = t.from_account_id and from_account.user_id = t.user_id
    left join public.account to_account
      on to_account.id = t.to_account_id and to_account.user_id = t.user_id
    where t.user_id = auth.uid()
      and t.parent_transaction_id is null
      and (p_type is null or t.type = p_type)
      and (p_tag_id is null or t.tag_id = p_tag_id)
      and (
        p_account_id is null or
        t.from_account_id = p_account_id or
        t.to_account_id = p_account_id
      )
      and (
        p_group_id is null or
        from_account.group_id = p_group_id or
        to_account.group_id = p_group_id
      )
      and (p_date_from is null or t.date >= p_date_from)
      and (p_date_to is null or t.date <= p_date_to)
      and (p_split_id is null or t.split_id = p_split_id)
      and (p_debt_id is null or t.debt_id = p_debt_id)
      and (
        v_search is null or
        t.description ilike v_like escape '\' or
        tag.name ilike v_like escape '\' or
        from_account.name ilike v_like escape '\' or
        to_account.name ilike v_like escape '\'
      )
  )
  select
    f.id,
    f.user_id,
    f.amount_centavos,
    f.type,
    f.tag_id,
    f.from_account_id,
    f.to_account_id,
    f.fee_centavos,
    f.description,
    f.date,
    f.parent_transaction_id,
    f.created_at,
    f.updated_at,
    f.recurring_id,
    f.split_id,
    f.debt_id,
    f.is_installment_portion,
    f.recurring_service,
    count(*) over() as total_count
  from filtered f
  order by
    case when v_sort_key = 'date' and v_sort_dir = 'asc' then f.date end asc,
    case when v_sort_key = 'date' and v_sort_dir = 'asc' then f.created_at end asc,
    case when v_sort_key = 'date' and v_sort_dir = 'desc' then f.date end desc,
    case when v_sort_key = 'date' and v_sort_dir = 'desc' then f.created_at end desc,
    case when v_sort_key = 'amount' and v_sort_dir = 'asc' then f.amount_centavos end asc,
    case when v_sort_key = 'amount' and v_sort_dir = 'desc' then f.amount_centavos end desc,
    case when v_sort_key = 'tag' and v_sort_dir = 'asc' then f.tag_sort_name end asc,
    case when v_sort_key = 'tag' and v_sort_dir = 'desc' then f.tag_sort_name end desc,
    case when v_sort_key = 'account' and v_sort_dir = 'asc' then f.account_sort_name end asc,
    case when v_sort_key = 'account' and v_sort_dir = 'desc' then f.account_sort_name end desc,
    f.date desc,
    f.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.transaction_month_summary(
  p_date_from date,
  p_date_to_exclusive date,
  p_account_id uuid default null
)
returns table (
  net_inflow_centavos bigint,
  net_outflow_centavos bigint,
  net_centavos bigint,
  account_inflow_centavos bigint,
  account_outflow_centavos bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select *
      from public.transaction t
     where t.user_id = auth.uid()
       and t.parent_transaction_id is null
       and t.date >= p_date_from
       and t.date < p_date_to_exclusive
  )
  select
    coalesce(sum(amount_centavos) filter (where type = 'income'), 0)::bigint
      as net_inflow_centavos,
    coalesce(sum(amount_centavos) filter (where type = 'expense'), 0)::bigint
      as net_outflow_centavos,
    (
      coalesce(sum(amount_centavos) filter (where type = 'income'), 0) -
      coalesce(sum(amount_centavos) filter (where type = 'expense'), 0)
    )::bigint as net_centavos,
    coalesce(sum(amount_centavos) filter (
      where p_account_id is not null
        and (
          (type = 'income' and to_account_id = p_account_id) or
          (type = 'transfer' and to_account_id = p_account_id)
        )
    ), 0)::bigint as account_inflow_centavos,
    coalesce(sum(amount_centavos) filter (
      where p_account_id is not null
        and (
          (type = 'expense' and from_account_id = p_account_id) or
          (type = 'transfer' and from_account_id = p_account_id)
        )
    ), 0)::bigint as account_outflow_centavos
  from scoped;
$$;

grant execute on function public.transaction_list(
  public.transaction_type, uuid, uuid, uuid, date, date, uuid, uuid, text, text, text, int, int
) to authenticated;

grant execute on function public.transaction_month_summary(date, date, uuid) to authenticated;
