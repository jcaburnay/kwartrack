-- Supabase OAuth scopes only control identity claims; they do not restrict
-- database access. Bind OAuth reads to the one ChatGPT client registered for
-- Kwartrack while preserving first-party browser sessions (no client_id).

create or replace function public.is_approved_data_reader()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'client_id', '') in (
    '',
    'f5d50b9f-94ce-4aa9-b598-ade3829361f9'
  );
$$;

comment on function public.is_approved_data_reader() is
  'Allows first-party sessions and Kwartrack''s approved ChatGPT OAuth client.';

do $$
declare
  v_table text;
  v_tables text[] := array[
    'user_profile',
    'tag',
    'budget_config',
    'account_group',
    'account',
    'transaction',
    'recurring',
    'budget_allocation',
    'person',
    'split_event',
    'split_participant',
    'debt'
  ];
begin
  foreach v_table in array v_tables loop
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using (public.is_approved_data_reader())',
      v_table || '_restrict_oauth_reader',
      v_table
    );
  end loop;
end;
$$;
