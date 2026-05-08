-- Extend handle_new_user to source display_name from OAuth provider metadata.
-- Google sets `full_name`; some OIDC providers set `name`. Without these, OAuth
-- signups fall back to the email local-part (e.g. "jonathan" instead of
-- "Jonathan Caburnay").
--
-- Each path is wrapped in nullif(btrim(...), '') so empty strings and
-- whitespace-only values fall through to the next fallback rather than
-- violating the user_profile.display_name length-between-1-and-50 check.
-- Final left(..., 50) truncates names that exceed Google's max-length range
-- (e.g. names with multiple middle names). 'New user' is the last-resort
-- fallback if nothing else resolves to a non-empty value.
--
-- Body is otherwise identical to the original definition in
-- 20260424053724_auth_bootstrap.sql.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New user'
  ), 50);
  v_timezone     text := coalesce(new.raw_user_meta_data ->> 'timezone', 'Asia/Manila');
  v_month        text := to_char((now() at time zone v_timezone)::date, 'YYYY-MM');
begin
  insert into public.user_profile (id, display_name, timezone, theme)
  values (new.id, v_display_name, v_timezone, 'system');

  insert into public.tag (user_id, name, type, is_system) values
    -- Default expense tags.
    (new.id, 'foods', 'expense', false),
    (new.id, 'grocery', 'expense', false),
    (new.id, 'transportation', 'expense', false),
    (new.id, 'online-shopping', 'expense', false),
    (new.id, 'gadgets', 'expense', false),
    (new.id, 'bills', 'expense', false),
    (new.id, 'pets', 'expense', false),
    (new.id, 'personal-care', 'expense', false),
    (new.id, 'health', 'expense', false),
    (new.id, 'digital-subscriptions', 'expense', false),
    (new.id, 'entertainment', 'expense', false),
    (new.id, 'clothing', 'expense', false),
    (new.id, 'education', 'expense', false),
    (new.id, 'travel', 'expense', false),
    (new.id, 'housing', 'expense', false),
    (new.id, 'insurance', 'expense', false),
    (new.id, 'gifts', 'expense', false),
    (new.id, 'dates', 'expense', false),
    (new.id, 'interest-paid', 'expense', false),
    -- Default income tags (note: 'gifts' is intentionally duplicated across scopes).
    (new.id, 'monthly-salary', 'income', false),
    (new.id, 'freelance', 'income', false),
    (new.id, 'interest-earned', 'income', false),
    (new.id, 'bonus', 'income', false),
    (new.id, 'gifts', 'income', false),
    -- System tags (hidden from user-picker UI).
    (new.id, 'transfer-fees', 'expense', true),
    (new.id, 'debt-settlement', 'any', true),
    (new.id, 'debt-settlement-orphan', 'any', true);

  insert into public.budget_config (user_id, month, overall_centavos)
  values (new.id, v_month, 0);

  return new;
end;
$$;
