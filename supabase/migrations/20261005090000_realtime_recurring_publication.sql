-- Deliver server-side recurring schedule changes to active clients.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recurring'
  ) then
    alter publication supabase_realtime add table public.recurring;
  end if;
end $$;
