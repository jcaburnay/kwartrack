-- Lock the cron-only admin RPCs to service_role.
--
-- recurring_fire_due() and td_check_maturity_due() are SECURITY DEFINER
-- functions that iterate every row across every user (they're meant to be
-- invoked by an external scheduler using the service-role key). Postgres'
-- default GRANT on a public.* function gives EXECUTE to PUBLIC, which
-- PostgREST surfaces as a callable RPC for any authenticated user. Without
-- this revoke, a random signup could call these and trigger every other
-- user's recurring transactions or time-deposit maturities.

revoke execute on function public.recurring_fire_due()    from public;
revoke execute on function public.recurring_fire_due()    from anon;
revoke execute on function public.recurring_fire_due()    from authenticated;

revoke execute on function public.td_check_maturity_due() from public;
revoke execute on function public.td_check_maturity_due() from anon;
revoke execute on function public.td_check_maturity_due() from authenticated;
