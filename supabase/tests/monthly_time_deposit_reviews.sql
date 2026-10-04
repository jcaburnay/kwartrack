begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000501', 'monthly-review@example.invalid',
  '{"display_name":"Review regression","timezone":"Asia/Manila"}');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval)
values ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000501',
  'Additional income', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly');
insert into public.recurring(id, user_id, service, type, tag_id, to_account_id,
  amount_centavos, interval, first_occurrence_date, next_occurrence_at, remaining_occurrences)
select '00000000-0000-4000-8000-000000000503', user_id, 'Separate same-tag income',
  'income', id, '00000000-0000-4000-8000-000000000502', 12345, 'monthly',
  (now() at time zone 'Asia/Manila')::date, now(), 1
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'interest-earned';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where recurring_id = '00000000-0000-4000-8000-000000000503'),
  1::bigint, 'Unrelated income to the same monthly TD and tag fires normally');
select ok((select is_completed and remaining_occurrences = 0 from public.recurring
  where id = '00000000-0000-4000-8000-000000000503'), 'Unrelated same-tag installment completes normally');
-- Repair must distinguish the generated interest schedule from user income.
delete from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000502');
insert into public.recurring(id, user_id, service, type, tag_id, to_account_id,
  amount_centavos, interval, first_occurrence_date, next_occurrence_at, remaining_occurrences)
select '00000000-0000-4000-8000-000000000504', user_id, 'Another same-tag income',
  'income', id, '00000000-0000-4000-8000-000000000502', 23456, 'monthly',
  (now() at time zone 'Asia/Manila')::date, now(), 1
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'interest-earned';
select public.recurring_fire_due();
select ok((select interest_recurring_id not in ('00000000-0000-4000-8000-000000000503',
  '00000000-0000-4000-8000-000000000504') from public.account
  where id = '00000000-0000-4000-8000-000000000502'), 'Repair does not adopt unrelated same-tag recurring');
select is((select count(*) from public.transaction where recurring_id = '00000000-0000-4000-8000-000000000504'),
  1::bigint, 'Unrelated same-tag income still fires when interest schedule is repaired');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000501',
  'Limited interest', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 2 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000505');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000505'),
  2::bigint, 'Monthly interest catches up only the configured two occurrences');
select ok((select r.is_completed and r.remaining_occurrences = 0 from public.recurring r
  join public.account a on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000505'),
  'Monthly interest decrements and completes the occurrence limit');
select ok((select bool_and(is_installment_portion) from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000505'), 'Limited interest postings carry installment metadata');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000505'),
  2::bigint, 'Completed monthly interest schedule does not post on later cron runs');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000501',
  'Retired interest', 'time-deposit', 15000000, 15000000, 600, '2020-10-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
select public.td_check_maturity_due();
select ok((select tag_id is null from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000506'), 'Maturity releases the protected tag reference');
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000506'), '2020-10-01'::date,
  'Retirement retains the authoritative posting cursor');
update public.account set interest_posting_interval = 'at-maturity'
  where id = '00000000-0000-4000-8000-000000000502';
select ok((select tag_id is null from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000502'), 'Cadence retirement releases the protected tag reference');
-- Remove the remaining visible references, as a user can do before deleting a tag.
delete from public.recurring where user_id = '00000000-0000-4000-8000-000000000501';
delete from public.transaction where user_id = '00000000-0000-4000-8000-000000000501';
select lives_ok($$delete from public.tag where user_id = '00000000-0000-4000-8000-000000000501'
  and name = 'interest-earned'$$, 'Unreferenced interest tag can be deleted after schedules retire');
select * from finish();
rollback;
