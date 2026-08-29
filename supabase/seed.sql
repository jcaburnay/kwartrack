-- Synthetic local-development data only.
--
-- This file runs after migrations on `supabase start` and `supabase db reset`.
-- It must never connect to, copy from, or contain data from a hosted environment.
-- Sign in locally with: demo@kwartrack.local / demo-password

do $$
declare
  demo_user_id constant uuid := '00000000-0000-4000-8000-000000000001';
  demo_group_id constant uuid := '10000000-0000-4000-8000-000000000001';
  wallet_id constant uuid := '20000000-0000-4000-8000-000000000001';
  savings_id constant uuid := '20000000-0000-4000-8000-000000000002';
  credit_id constant uuid := '20000000-0000-4000-8000-000000000003';
  current_month text := to_char(current_date, 'YYYY-MM');
  foods_tag_id uuid;
  subscriptions_tag_id uuid;
  salary_tag_id uuid;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    'demo@kwartrack.local',
    crypt('demo-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo User","timezone":"Asia/Manila"}'::jsonb,
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    '30000000-0000-4000-8000-000000000001',
    demo_user_id,
    demo_user_id::text,
    jsonb_build_object('sub', demo_user_id::text, 'email', 'demo@kwartrack.local'),
    'email',
    now(),
    now(),
    now()
  );

  select id into foods_tag_id
  from public.tag
  where user_id = demo_user_id and name = 'foods' and type = 'expense';

  select id into subscriptions_tag_id
  from public.tag
  where user_id = demo_user_id and name = 'digital-subscriptions' and type = 'expense';

  select id into salary_tag_id
  from public.tag
  where user_id = demo_user_id and name = 'monthly-salary' and type = 'income';

  insert into public.account_group (id, user_id, name)
  values (demo_group_id, demo_user_id, 'Everyday Money');

  insert into public.account (
    id, user_id, name, type, group_id, initial_balance_centavos
  ) values
    (wallet_id, demo_user_id, 'Everyday Wallet', 'e-wallet', demo_group_id, 500000),
    (savings_id, demo_user_id, 'Savings', 'savings', demo_group_id, 2500000);

  insert into public.account (
    id, user_id, name, type, initial_balance_centavos, credit_limit_centavos
  ) values
    (credit_id, demo_user_id, 'Credit Card', 'credit', 350000, 5000000);

  insert into public.transaction (
    user_id, amount_centavos, type, tag_id, to_account_id, description, date
  ) values (
    demo_user_id, 3000000, 'income', salary_tag_id, savings_id,
    'Monthly salary', current_date - 12
  );

  insert into public.transaction (
    user_id, amount_centavos, type, tag_id, from_account_id, description, date
  ) values
    (demo_user_id, 125050, 'expense', foods_tag_id, wallet_id,
      'Groceries', current_date - 5),
    (demo_user_id, 89900, 'expense', subscriptions_tag_id, credit_id,
      'Annual software plan', current_date - 2);

  insert into public.transaction (
    user_id, amount_centavos, type, from_account_id, to_account_id, description, date
  ) values (
    demo_user_id, 200000, 'transfer', savings_id, wallet_id,
    'Weekly spending money', current_date - 7
  );

  update public.budget_config
  set overall_centavos = 2000000
  where user_id = demo_user_id and month = current_month;

  insert into public.budget_allocation (user_id, month, tag_id, amount_centavos)
  values
    (demo_user_id, current_month, foods_tag_id, 600000),
    (demo_user_id, current_month, subscriptions_tag_id, 300000);
end
$$;
