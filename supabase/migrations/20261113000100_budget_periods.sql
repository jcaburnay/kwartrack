-- Inclusive budget periods. Keep monthly tables operational during deployment.
create extension if not exists btree_gist with schema extensions;

create table public.budget_period (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  overall_centavos bigint not null default 0 check (overall_centavos >= 0),
  legacy_month text check (legacy_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date and start_date >= date '0001-01-01' and end_date < date '9999-01-01'),
  unique (user_id, id),
  unique (user_id, legacy_month),
  exclude using gist (user_id with =, daterange(start_date, end_date, '[]') with &&)
);

alter table public.tag add constraint tag_user_id_id_unique unique (user_id, id);
create table public.budget_period_allocation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null,
  tag_id uuid not null,
  amount_centavos bigint not null check (amount_centavos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, period_id) references public.budget_period(user_id,id) on delete cascade,
  foreign key (user_id, tag_id) references public.tag(user_id,id) on delete cascade,
  unique (period_id,tag_id)
);
create index budget_period_allocation_owner_idx on public.budget_period_allocation(user_id);
create index budget_period_allocation_tag_idx on public.budget_period_allocation(tag_id);

-- Fail on inconsistent historical data instead of silently changing amounts.
do $$ begin
  if exists (
    select 1 from public.budget_allocation a left join public.budget_config c
      on c.user_id=a.user_id and c.month=a.month
    group by a.user_id,a.month,c.overall_centavos
    having c.overall_centavos is null or sum(a.amount_centavos)>c.overall_centavos
  ) then raise exception 'Repair inconsistent monthly budgets before migrating budget periods'; end if;
end $$;
insert into public.budget_period(user_id,start_date,end_date,overall_centavos,legacy_month,created_at,updated_at)
select user_id,(month||'-01')::date,((month||'-01')::date + interval '1 month - 1 day')::date,
       overall_centavos,month,created_at,updated_at from public.budget_config;
insert into public.budget_period_allocation(id,user_id,period_id,tag_id,amount_centavos,created_at,updated_at)
select a.id,a.user_id,p.id,a.tag_id,a.amount_centavos,a.created_at,a.updated_at
from public.budget_allocation a join public.budget_period p on p.user_id=a.user_id and p.legacy_month=a.month;

do $$ declare t text; begin
  foreach t in array array['budget_period','budget_period_allocation'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using (auth.uid()=user_id and public.is_approved_data_reader())',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (auth.uid()=user_id and not public.is_oauth_access_token())',t);
    execute format('create policy owner_update on public.%I for update to authenticated using (auth.uid()=user_id and not public.is_oauth_access_token()) with check (auth.uid()=user_id and not public.is_oauth_access_token())',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (auth.uid()=user_id and not public.is_oauth_access_token())',t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;

-- Every write for one owner takes the same transaction-scoped mutex, including
-- legacy writes. VOLATILE trigger queries after the lock see committed changes.
create function public.budget_period_lock_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id,old.user_id)::text, 74185));
  if tg_op='UPDATE' then
    if new.user_id<>old.user_id or new.id<>old.id then
      raise exception 'Budget identity cannot be changed' using errcode='23514';
    end if;
    if tg_table_name='budget_period' then
      if new.legacy_month is distinct from old.legacy_month then
        raise exception 'Budget legacy identity cannot be changed' using errcode='23514';
      end if;
    elsif tg_table_name='budget_period_allocation' then
      if new.period_id<>old.period_id or new.tag_id<>old.tag_id then
        raise exception 'Allocation identity cannot be changed' using errcode='23514';
      end if;
    elsif tg_table_name in ('budget_config','budget_allocation') then
      if new.month<>old.month then raise exception 'Budget month cannot be changed' using errcode='23514'; end if;
      if tg_table_name='budget_allocation' then
        if new.tag_id<>old.tag_id then
          raise exception 'Allocation identity cannot be changed' using errcode='23514';
        end if;
      end if;
    end if;
  end if;
  return coalesce(new,old);
end $$;
revoke all on function public.budget_period_lock_owner() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['budget_period','budget_period_allocation','budget_config','budget_allocation'] loop
    execute format('create trigger budget_00_lock before insert or update or delete on public.%I for each row execute function public.budget_period_lock_owner()',t);
  end loop;
end $$;

create function public.budget_period_check_cap() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_sum numeric; v_cap bigint;
begin
  if tg_table_name='budget_period' then v_id:=new.id; else v_id:=new.period_id; end if;
  select overall_centavos into v_cap from public.budget_period where id=v_id;
  select coalesce(sum(amount_centavos),0) into v_sum from public.budget_period_allocation where period_id=v_id;
  if v_sum>coalesce(v_cap,0) then
    raise exception 'Tag allocations exceed the overall budget cap. Increase the cap or reduce an allocation.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.budget_period_check_cap() from public,anon,authenticated;
create trigger budget_10_cap after insert or update on public.budget_period
  for each row execute function public.budget_period_check_cap();
create trigger budget_10_cap after insert or update on public.budget_period_allocation
  for each row execute function public.budget_period_check_cap();

-- Bidirectional synchronization only for migrated, exact calendar months.
-- Once dates become custom, reject old-client edits rather than overwrite them.
create function public.sync_budget_monthly() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.budget_period; v_month text; v_owner uuid; v_tag uuid;
begin
  if current_setting('kwartrack.budget_mirroring',true)='on' then return coalesce(new,old); end if;
  v_owner:=coalesce(new.user_id,old.user_id);
  perform set_config('kwartrack.budget_mirroring','on',true);
  if tg_table_name in ('budget_config','budget_allocation') then
    v_month:=coalesce(new.month,old.month);
    select * into p from public.budget_period where user_id=v_owner and legacy_month=v_month;
    if found and (p.start_date<>(v_month||'-01')::date or p.end_date<>((v_month||'-01')::date+interval '1 month - 1 day')::date) then
      raise exception 'This budget now uses custom dates. Refresh Kwartrack before editing it.' using errcode='23514';
    end if;
    if tg_table_name='budget_config' then
      if tg_op='DELETE' then
        delete from public.budget_period where id=p.id;
      else
        insert into public.budget_period(user_id,start_date,end_date,overall_centavos,legacy_month)
        values(new.user_id,(new.month||'-01')::date,((new.month||'-01')::date+interval '1 month - 1 day')::date,new.overall_centavos,new.month)
        on conflict(user_id,legacy_month) do update set overall_centavos=excluded.overall_centavos;
      end if;
    elsif tg_op='DELETE' then
      delete from public.budget_period_allocation where period_id=p.id and tag_id=old.tag_id;
    else
      if p.id is null then raise exception 'Set the overall budget before allocating tags' using errcode='23514'; end if;
      insert into public.budget_period_allocation(user_id,period_id,tag_id,amount_centavos)
      values(new.user_id,p.id,new.tag_id,new.amount_centavos)
      on conflict(period_id,tag_id) do update set amount_centavos=excluded.amount_centavos;
    end if;
  else
    if tg_table_name='budget_period' then p:=coalesce(new,old);
    else select * into p from public.budget_period where id=coalesce(new.period_id,old.period_id); end if;
    v_month:=p.legacy_month;
    if v_month is not null and p.start_date=(v_month||'-01')::date and p.end_date=((v_month||'-01')::date+interval '1 month - 1 day')::date then
      if tg_table_name='budget_period' then
        if tg_op='DELETE' then
          delete from public.budget_allocation where user_id=v_owner and month=v_month;
          delete from public.budget_config where user_id=v_owner and month=v_month;
        else
          -- Reentering calendar-month compatibility may follow allocation edits
          -- made while custom. Rebuild the legacy snapshot in this transaction.
          delete from public.budget_allocation where user_id=v_owner and month=v_month;
          insert into public.budget_config(user_id,month,overall_centavos) values(v_owner,v_month,p.overall_centavos)
          on conflict(user_id,month) do update set overall_centavos=excluded.overall_centavos;
          insert into public.budget_allocation(user_id,month,tag_id,amount_centavos)
          select user_id,v_month,tag_id,amount_centavos from public.budget_period_allocation where period_id=p.id;
        end if;
      elsif tg_op='DELETE' then
        delete from public.budget_allocation where user_id=v_owner and month=v_month and tag_id=old.tag_id;
      else
        insert into public.budget_allocation(user_id,month,tag_id,amount_centavos) values(v_owner,v_month,new.tag_id,new.amount_centavos)
        on conflict(user_id,month,tag_id) do update set amount_centavos=excluded.amount_centavos;
      end if;
    end if;
  end if;
  perform set_config('kwartrack.budget_mirroring','off',true);
  return coalesce(new,old);
end $$;
revoke all on function public.sync_budget_monthly() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['budget_period','budget_period_allocation','budget_config','budget_allocation'] loop
    execute format('create trigger budget_90_sync after insert or update or delete on public.%I for each row execute function public.sync_budget_monthly()',t);
  end loop;
end $$;

create function public.budget_range_actuals(p_start date,p_end date)
returns table(tag_id uuid,actual_centavos bigint)
language sql stable security invoker set search_path=public,pg_temp as $$
  select t.tag_id,sum(coalesce(s.user_share_centavos,t.amount_centavos))::bigint
  from public.transaction t left join public.split_event s on s.id=t.split_id
  where t.user_id=auth.uid() and t.type='expense' and t.parent_transaction_id is null
    and t.date>=p_start and t.date<=p_end
  group by t.tag_id;
$$;
revoke all on function public.budget_range_actuals(date,date) from public,anon;
grant execute on function public.budget_range_actuals(date,date) to authenticated,service_role;

create function public.copy_budget_period(p_target uuid,p_source uuid) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.budget_period; t public.budget_period;
begin
  if auth.uid() is null or public.is_oauth_access_token() then raise exception 'Not authorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,74185));
  select * into s from public.budget_period where id=p_source and user_id=auth.uid();
  select * into t from public.budget_period where id=p_target and user_id=auth.uid();
  if s.id is null or t.id is null or s.id=t.id or s.end_date>=t.start_date then
    raise exception 'Choose an earlier budget period to copy' using errcode='23514';
  end if;
  if exists(select 1 from public.budget_period_allocation where period_id=t.id) then
    raise exception 'This budget already has allocations. Copy into an empty budget.' using errcode='23514';
  end if;
  update public.budget_period set overall_centavos=s.overall_centavos where id=t.id;
  insert into public.budget_period_allocation(user_id,period_id,tag_id,amount_centavos)
  select auth.uid(),t.id,tag_id,amount_centavos from public.budget_period_allocation where period_id=s.id;
end $$;
revoke all on function public.copy_budget_period(uuid,uuid) from public,anon;
grant execute on function public.copy_budget_period(uuid,uuid) to authenticated;

alter publication supabase_realtime add table public.budget_period,public.budget_period_allocation;
