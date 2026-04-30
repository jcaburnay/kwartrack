-- Realtime: enable Postgres CDC for `transaction` and `account`.
-- Postgres Changes only delivers events for tables in the `supabase_realtime`
-- publication. RLS already scopes events per user, so adding the tables here
-- is sufficient — clients still only see rows they're allowed to read.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transaction'
  ) then
    alter publication supabase_realtime add table public.transaction;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'account'
  ) then
    alter publication supabase_realtime add table public.account;
  end if;
end $$;
