begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(73);

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
-- Saved descriptions apply to new generated postings, without rewriting history.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000514', '00000000-0000-4000-8000-000000000501',
  'Editable description', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set description = 'Saved monthly interest note', remaining_occurrences = 1
where id = (select interest_recurring_id from public.account where id = '00000000-0000-4000-8000-000000000514');
select public.recurring_fire_due();
select is((select description from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000514'
  and date = '2020-10-01'), 'Saved monthly interest note', 'Monthly posting uses the saved recurring description');
update public.recurring set description = 'Updated monthly interest note', remaining_occurrences = 1,
  is_completed = false, completed_at = null
where id = (select interest_recurring_id from public.account where id = '00000000-0000-4000-8000-000000000514');
select public.recurring_fire_due();
select is((select description from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000514'
  and date = '2020-11-01'), 'Updated monthly interest note', 'An edited description applies to the next interest posting');
select is((select description from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000514'
  and date = '2020-10-01'), 'Saved monthly interest note', 'Description edits leave already generated history untouched');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000515', '00000000-0000-4000-8000-000000000501',
  'Default description', 'time-deposit', 100, 100, 600, '2020-11-01', 'monthly', '2020-10-01T00:00:00+08:00');
update public.recurring set description = '   ' where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000515');
select public.recurring_fire_due();
select is((select description from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000515'),
  'Interest 2020-10-01 to 2020-10-31 (ACT/365, net of 20% tax)',
  'A blank saved description falls back to the calculated period description');
-- A public account archive can succeed without the separate recurring pause request.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-000000000501',
  'Archive without pause', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000516';
select ok((select is_paused from public.recurring where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000516')),
  'Archiving a monthly deposit pauses its recurring in the same database update');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000516'),
  0::bigint, 'Archived deposits skip posting even when recurring pause never succeeded');
update public.account set is_archived = false where id = '00000000-0000-4000-8000-000000000516';
select ok((select not is_paused from public.recurring where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000516')),
  'Unarchiving releases the archive-owned pause without a second UI update');
-- The UI resume request may write false to an already-false pause flag.
update public.recurring set is_paused = false where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000516');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000516'),
  0::bigint, 'Unarchive does not backfill archived months when the pause flag was already false');
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000516'), date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Unarchive records skipped completed calendar periods independently of recurring resume');
select is((select (next_occurrence_at at time zone 'Asia/Manila')::date from public.recurring
  where id = (select interest_recurring_id from public.account where id = '00000000-0000-4000-8000-000000000516')),
  (date_trunc('month', now() at time zone 'Asia/Manila') + interval '1 month')::date,
  'Unarchive schedules the next calendar posting after skipped archived periods');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000517', '00000000-0000-4000-8000-000000000501',
  'Manual pause survives archive', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila');
update public.recurring set is_paused = true where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000517');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000517';
update public.account set is_archived = false where id = '00000000-0000-4000-8000-000000000517';
select ok((select is_paused from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000517')), 'Account unarchive leaves an independently paused recurring paused');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000518', '00000000-0000-4000-8000-000000000501',
  'Archive missing schedule', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000518';
-- Match the UI's separate pause request before the generated row is deleted.
update public.recurring set is_paused = true where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000518');
delete from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000518');
update public.account set is_archived = false where id = '00000000-0000-4000-8000-000000000518';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000518'),
  0::bigint, 'Unarchive skips archived months even when the generated schedule must be repaired');
select ok((select not r.is_paused from public.recurring r join public.account a
  on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000518'),
  'Unarchive releases an archive-owned pause after schedule repair');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000528', '00000000-0000-4000-8000-000000000501',
  'Deleted manual pause', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila');
update public.recurring set is_paused = true where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000528');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000528';
delete from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000528');
update public.account set is_archived = false where id = '00000000-0000-4000-8000-000000000528';
select public.recurring_fire_due();
select ok((select r.is_paused from public.recurring r join public.account a
  on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000528'),
  'Unarchive preserves a manual pause after schedule repair');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000529', '00000000-0000-4000-8000-000000000501',
  'Pause override while archived', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000529';
update public.recurring set is_paused = false where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000529');
update public.recurring set is_paused = true where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000529');
select ok((select not archive_owned_pause and is_paused from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000529'),
  'Resuming an archive-owned pause releases ownership before a later manual pause');
update public.account set is_archived = false where id = '00000000-0000-4000-8000-000000000529';
select ok((select r.is_paused from public.recurring r join public.account a
  on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000529'),
  'Unarchive retains the manually reapplied pause');
-- Match the UI payload: countdown edits do not explicitly send completion flags.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000519', '00000000-0000-4000-8000-000000000501',
  'UI countdown reset', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly', '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000519');
select public.recurring_fire_due();
update public.recurring set remaining_occurrences = 2 where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000519');
select ok((select not r.is_completed and r.completed_at is null and not st.is_completed
  from public.recurring r join public.td_monthly_interest_state st on st.recurring_id = r.id
  where st.account_id = '00000000-0000-4000-8000-000000000519'),
  'A positive UI countdown edit reactivates both recurring and protected completion');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000519'),
  3::bigint, 'Reactivated UI countdown posts exactly the two new occurrences');
update public.recurring set remaining_occurrences = null where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000519');
select ok((select not r.is_completed and r.completed_at is null and not st.is_completed
  from public.recurring r join public.td_monthly_interest_state st on st.recurring_id = r.id
  where st.account_id = '00000000-0000-4000-8000-000000000519'),
  'Clearing the completed countdown through the UI payload reactivates an open-ended schedule');
update public.recurring set is_paused = true where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000519');
-- One completed period leaves an active three-occurrence schedule with two remaining.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000520', '00000000-0000-4000-8000-000000000501',
  'Repair finite countdown', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '1 month') at time zone 'Asia/Manila');
update public.recurring set remaining_occurrences = 3 where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000520');
select public.recurring_fire_due();
select is((select remaining_occurrences from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000520')), 2,
  'An active finite monthly schedule decrements its first actual posting');
delete from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000520');
select public.recurring_fire_due();
select is((select remaining_occurrences from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000520')), 2,
  'Missing active schedule repair preserves its remaining finite countdown');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000520'),
  1::bigint, 'Finite schedule repair preserves the processed cursor without reposting');
-- Deleted paused schedules must remain controllable without backfilling paused months.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000521', '00000000-0000-4000-8000-000000000501',
  'Paused repair', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set is_paused = true, remaining_occurrences = 4
  where id = (select interest_recurring_id from public.account where id = '00000000-0000-4000-8000-000000000521');
delete from public.recurring where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000521');
select public.recurring_fire_due();
select ok((select r.is_paused and r.remaining_occurrences = 4 from public.recurring r join public.account a
  on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000521'),
  'Repair preserves both intentional pause and remaining countdown');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000521'),
  0::bigint, 'Deleted paused schedule does not backfill during repair');
update public.recurring set is_paused = false where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000521');
select public.recurring_fire_due();
select is((select accrued_through from public.td_monthly_interest_state where account_id = '00000000-0000-4000-8000-000000000521'),
  date_trunc('month', now() at time zone 'Asia/Manila')::date, 'Repaired pause resumes at the current month cursor');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000521'),
  0::bigint, 'Explicit resume skips completed paused months after repair');
-- Completed periodic cadence round trips explicitly start a fresh monthly countdown.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000522', '00000000-0000-4000-8000-000000000501',
  'quarterly restart', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000522');
select public.recurring_fire_due();
update public.account set interest_posting_interval = 'quarterly' where id = '00000000-0000-4000-8000-000000000522';
update public.account set interest_posting_interval = 'monthly' where id = '00000000-0000-4000-8000-000000000522';
select ok((select not r.is_completed and r.completed_at is null and r.remaining_occurrences is null
  from public.recurring r join public.account a on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000522'),
  'quarterly round trip restarts a completed schedule with an open-ended countdown');
select public.recurring_fire_due();
select ok((select count(*) > 1 from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000522'),
  'quarterly round trip resumes actual monthly postings');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000522' and date = '2020-10-01'),
  1::bigint, 'quarterly round trip preserves previously credited periods');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000523', '00000000-0000-4000-8000-000000000501',
  'semi-annual restart', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000523');
select public.recurring_fire_due();
update public.account set interest_posting_interval = 'semi-annual' where id = '00000000-0000-4000-8000-000000000523';
update public.account set interest_posting_interval = 'monthly' where id = '00000000-0000-4000-8000-000000000523';
select ok((select not r.is_completed and r.completed_at is null and r.remaining_occurrences is null
  from public.recurring r join public.account a on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000523'),
  'semi-annual round trip restarts a completed schedule with an open-ended countdown');
select public.recurring_fire_due();
select ok((select count(*) > 1 from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000523'),
  'semi-annual round trip resumes actual monthly postings');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000523' and date = '2020-10-01'),
  1::bigint, 'semi-annual round trip preserves previously credited periods');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000524', '00000000-0000-4000-8000-000000000501',
  'annual restart', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000524');
select public.recurring_fire_due();
update public.account set interest_posting_interval = 'annual' where id = '00000000-0000-4000-8000-000000000524';
update public.account set interest_posting_interval = 'monthly' where id = '00000000-0000-4000-8000-000000000524';
select ok((select not r.is_completed and r.completed_at is null and r.remaining_occurrences is null
  from public.recurring r join public.account a on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000524'),
  'annual round trip restarts a completed schedule with an open-ended countdown');
select public.recurring_fire_due();
select ok((select count(*) > 1 from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000524'),
  'annual round trip resumes actual monthly postings');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000524' and date = '2020-10-01'),
  1::bigint, 'annual round trip preserves previously credited periods');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000525', '00000000-0000-4000-8000-000000000501',
  'Paused completed restart', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.recurring set remaining_occurrences = 1 where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000525');
select public.recurring_fire_due();
update public.recurring set is_paused = true where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000525');
update public.account set interest_posting_interval = 'quarterly' where id = '00000000-0000-4000-8000-000000000525';
update public.account set interest_posting_interval = 'monthly' where id = '00000000-0000-4000-8000-000000000525';
select ok((select r.is_paused and not r.is_completed and r.remaining_occurrences is null
  from public.recurring r join public.account a on a.interest_recurring_id = r.id
  where a.id = '00000000-0000-4000-8000-000000000525'), 'Periodic restart preserves manual pause while resetting completion');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000525'),
  1::bigint, 'A manually paused periodic restart does not fire');
update public.recurring set is_paused = false where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000525');
select public.recurring_fire_due();
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000525'),
  date_trunc('month', now() at time zone 'Asia/Manila')::date, 'Restarted manual pause resumes without old-period backfill');
-- Periodic cadence exposes fields that monthly processing owns again on return.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000526', '00000000-0000-4000-8000-000000000501',
  'Edited periodic schedule', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.account set interest_posting_interval = 'quarterly'
  where id = '00000000-0000-4000-8000-000000000526';
update public.recurring set type = 'transfer', tag_id = null,
  from_account_id = '00000000-0000-4000-8000-000000000517',
  fee_centavos = 123, interval = 'weekly', first_occurrence_date = '2021-04-13'
  where id = (select interest_recurring_id from public.account
    where id = '00000000-0000-4000-8000-000000000526');
update public.account set interest_posting_interval = 'monthly'
  where id = '00000000-0000-4000-8000-000000000526';
select ok((select r.type = 'income' and r.to_account_id = a.id and r.from_account_id is null
    and r.fee_centavos is null and r.tag_id is not null and r.interval = 'monthly'
    and r.first_occurrence_date = '2020-10-01'
  from public.recurring r join public.account a on a.interest_recurring_id = r.id
  where a.id = '00000000-0000-4000-8000-000000000526'),
  'Returning to monthly restores the generated income schedule shape');
select public.recurring_fire_due();
select ok((select count(*) > 0 from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000526'
    and type = 'income' and from_account_id is null and fee_centavos is null),
  'Restored monthly schedule posts income into the deposit');
-- A ledger balance update must not lock the linked recurring. The hourly
-- processor refreshes its display estimate from the committed ledger instead.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval)
values ('00000000-0000-4000-8000-000000000527', '00000000-0000-4000-8000-000000000501',
  'Balance estimate refresh', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly');
create temporary table before_balance_change as
  select amount_centavos from public.recurring where id = (select interest_recurring_id
    from public.account where id = '00000000-0000-4000-8000-000000000527');
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select user_id, 'income', id, '00000000-0000-4000-8000-000000000527', 10000000,
  (now() at time zone 'Asia/Manila')::date
from public.tag where user_id = '00000000-0000-4000-8000-000000000501' and name = 'interest-earned';
select is((select amount_centavos from public.recurring where id = (select interest_recurring_id
    from public.account where id = '00000000-0000-4000-8000-000000000527')),
  (select amount_centavos from before_balance_change),
  'Ledger balance update does not synchronously lock and retime the recurring');
select public.td_post_monthly_interest_due();
select ok((select amount_centavos from public.recurring where id = (select interest_recurring_id
    from public.account where id = '00000000-0000-4000-8000-000000000527')) >
  (select amount_centavos from before_balance_change),
  'Hourly monthly processor refreshes the next estimate from the ledger');
-- Remove the remaining visible references, as a user can do before deleting a tag.
delete from public.recurring where user_id = '00000000-0000-4000-8000-000000000501';
delete from public.transaction where user_id = '00000000-0000-4000-8000-000000000501';
select lives_ok($$delete from public.tag where user_id = '00000000-0000-4000-8000-000000000501'
  and name = 'interest-earned'$$, 'Unreferenced interest tag can be deleted after schedules retire');
select * from finish();
rollback;
