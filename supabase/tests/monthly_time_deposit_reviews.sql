begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(31);

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
select '00000000-0000-4000-8000-000000000504', user_id, 'Additional income — Interest',
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
-- Resetting a completed countdown deliberately resumes exactly the new limit.
update public.recurring set remaining_occurrences = 1, is_completed = false, completed_at = null
where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000505');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000505'),
  3::bigint, 'An explicitly reset countdown reactivates the completed monthly schedule');
delete from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000505');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000505'),
  3::bigint, 'Deleting completed monthly schedule does not resume interest postings');
select is((select count(*) from public.recurring where to_account_id = '00000000-0000-4000-8000-000000000505'),
  0::bigint, 'Completed schedule deletion does not create an open-ended replacement');
select ok((select interest_recurring_id is null from public.account
  where id = '00000000-0000-4000-8000-000000000505'), 'Deleted completed schedule keeps the account backlink empty');
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
-- A surviving protected identity is authoritative even after editable labels change.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval)
values ('00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000501',
  'Protected schedule', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly');
select public.td_post_monthly_interest_due();
create temporary table protected_schedule as select interest_recurring_id as id from public.account
  where id = '00000000-0000-4000-8000-000000000507';
update public.recurring set service = 'User renamed generated schedule' where id = (select id from protected_schedule);
update public.account set interest_recurring_id = null where id = '00000000-0000-4000-8000-000000000507';
select public.td_post_monthly_interest_due();
select is((select interest_recurring_id from public.account where id = '00000000-0000-4000-8000-000000000507'),
  (select id from protected_schedule), 'Repair restores protected schedule identity after backlink and label edits');
select is((select count(*) from public.recurring where to_account_id = '00000000-0000-4000-8000-000000000507'),
  1::bigint, 'Protected identity repair does not duplicate a surviving generated schedule');
-- The outer cadence update receives a null NEW backlink, while a nested trigger creates it.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000508', '00000000-0000-4000-8000-000000000501',
  'Legacy transition', 'time-deposit', 15000000, 15000000, 600, '2020-11-01', 'at-maturity',
  '2020-09-01T00:00:00+08:00');
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select user_id, 'income', id, '00000000-0000-4000-8000-000000000508', 60000, '2020-10-01'
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'interest-earned';
update public.account set interest_posting_interval = 'monthly'
  where id = '00000000-0000-4000-8000-000000000508';
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000508'), '2020-10-01'::date,
  'At-maturity to monthly transition adopts legacy credited period despite nested backlink creation');
select public.td_post_monthly_interest_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000508'),
  2::bigint, 'Cadence transition posts only the one remaining period');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000508'
  and date = '2020-10-01'), 1::bigint, 'Cadence transition does not repost already credited September');
-- ACT/365 can round a 31-day period positive even when the old annual/12 helper rounds zero.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000509', '00000000-0000-4000-8000-000000000501',
  'Tiny positive interest', 'time-deposit', 100, 100, 600, '2020-11-01', 'monthly',
  '2020-10-01T00:00:00+08:00');
select ok((select interest_recurring_id is not null from public.account
  where id = '00000000-0000-4000-8000-000000000509'), 'Tiny monthly deposit still has a linked estimate schedule');
select public.recurring_fire_due();
select is((select amount_centavos from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000509'),
  1::bigint, 'A 31-day tiny deposit posts its positive one-centavo ACT/365 interest');
select ok((select recurring_id is not null from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000509'), 'Tiny positive interest retains generated schedule provenance');
-- An explicit cadence transition creates a new identity, rather than repairing a deleted completed schedule.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000510', '00000000-0000-4000-8000-000000000501',
  'Restart through cadence', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000510');
select public.recurring_fire_due();
update public.account set interest_posting_interval = 'at-maturity'
  where id = '00000000-0000-4000-8000-000000000510';
update public.account set interest_posting_interval = 'monthly'
  where id = '00000000-0000-4000-8000-000000000510';
select ok((select not is_completed from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000510'), 'Explicit cadence restart clears protected completion');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000510');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000510'),
  2::bigint, 'Restarted cadence credits the next remaining period');
-- Generic due ledger entries must exist before historical monthly balance-day calculation.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000501',
   'Due income before interest', 'time-deposit', 15000000, 15000000, 600, '2020-10-01', 'monthly', '2020-09-01T00:00:00+08:00'),
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000501',
   'Due withdrawal before interest', 'time-deposit', 15000000, 15000000, 600, '2020-10-01', 'monthly', '2020-09-01T00:00:00+08:00');
insert into public.recurring(user_id, service, type, tag_id, to_account_id,
  amount_centavos, interval, first_occurrence_date, next_occurrence_at, remaining_occurrences)
select user_id, 'Backdated deposit', 'income', id, '00000000-0000-4000-8000-000000000511',
  5000000, 'monthly', '2020-09-16', '2020-09-16T00:00:00+08:00', 1
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'interest-earned';
insert into public.recurring(user_id, service, type, tag_id, from_account_id,
  amount_centavos, interval, first_occurrence_date, next_occurrence_at, remaining_occurrences)
select user_id, 'Backdated withdrawal', 'expense', id, '00000000-0000-4000-8000-000000000512',
  5000000, 'monthly', '2020-09-16', '2020-09-16T00:00:00+08:00', 1
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'foods';
-- Simulate overdue occurrences after the INSERT trigger chooses its initial schedule.
update public.recurring set next_occurrence_at = '2020-09-16T00:00:00+08:00'
where user_id = '00000000-0000-4000-8000-000000000501'
  and service in ('Backdated deposit', 'Backdated withdrawal');
-- Legacy edits may have changed even the generated type/destination; its
-- protected ID still determines which account owns monthly processing.
update public.recurring set type = 'expense', from_account_id = '00000000-0000-4000-8000-000000000512',
  to_account_id = null, tag_id = (select id from public.tag
    where user_id = '00000000-0000-4000-8000-000000000501' and name = 'foods')
where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000511');
-- Clearing only the backlink must not let the protected generated schedule fire generically.
update public.account set interest_recurring_id = null where id = '00000000-0000-4000-8000-000000000511';
select public.recurring_fire_due();
select is((select amount_centavos from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000511'
  and date = '2020-10-01'), 69041::bigint, 'Monthly interest includes a due midmonth income before advancing cursor');
select is((select amount_centavos from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000512'
  and date = '2020-10-01'), 49315::bigint, 'Monthly interest includes a due midmonth withdrawal before advancing cursor');
select is((select count(*) from public.transaction t join public.account a on a.interest_recurring_id = t.recurring_id
  where a.id = '00000000-0000-4000-8000-000000000511'), 1::bigint,
  'Missing-backlink generated schedule posts only through monthly calculation');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000513', '00000000-0000-4000-8000-000000000501',
  'Maturity processes due ledger', 'time-deposit', 15000000, 15000000, 600, '2020-10-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
insert into public.recurring(user_id, service, type, tag_id, to_account_id,
  amount_centavos, interval, first_occurrence_date, next_occurrence_at, remaining_occurrences)
select user_id, 'Deposit due before maturity', 'income', id, '00000000-0000-4000-8000-000000000513',
  5000000, 'monthly', '2020-09-16', '2020-09-16T00:00:00+08:00', 1
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'interest-earned';
update public.recurring set next_occurrence_at = '2020-09-16T00:00:00+08:00'
where user_id = '00000000-0000-4000-8000-000000000501' and service = 'Deposit due before maturity';
select public.td_check_maturity_due();
select is((select amount_centavos from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000513'
  and date = '2020-10-01'), 69041::bigint, 'Maturity job processes due ledger before final interest');
select ok((select is_matured from public.account where id = '00000000-0000-4000-8000-000000000513'),
  'Maturity closes the account after due ledger and final interest are posted');
-- Remove the remaining visible references, as a user can do before deleting a tag.
delete from public.recurring where user_id = '00000000-0000-4000-8000-000000000501';
delete from public.transaction where user_id = '00000000-0000-4000-8000-000000000501';
select lives_ok($$delete from public.tag where user_id = '00000000-0000-4000-8000-000000000501'
  and name = 'interest-earned'$$, 'Unreferenced interest tag can be deleted after schedules retire');
select * from finish();
rollback;
