-- ChatGPT's first integration is intentionally read-only. Supabase OAuth 2.1
-- access tokens include a client_id claim; first-party browser sessions do not.
-- Keep every existing SELECT policy intact while adding restrictive policies
-- that reject INSERT / UPDATE / DELETE whenever the caller is an OAuth client.

create or replace function public.is_oauth_access_token()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'client_id', '') <> '';
$$;

comment on function public.is_oauth_access_token() is
  'True when the current JWT was issued to a Supabase OAuth 2.1 client.';

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
      'create policy %I on public.%I as restrictive for insert to authenticated with check (not public.is_oauth_access_token())',
      v_table || '_block_oauth_insert',
      v_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (not public.is_oauth_access_token()) with check (not public.is_oauth_access_token())',
      v_table || '_block_oauth_update',
      v_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (not public.is_oauth_access_token())',
      v_table || '_block_oauth_delete',
      v_table
    );
  end loop;
end;
$$;
