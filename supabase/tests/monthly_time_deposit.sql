begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(43);

-- All fixtures are synthetic and rolled back. Dates deliberately remain in
-- the past so the real cron entrypoints can exercise catch-up deterministically.
insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000301', 'monthly-td@example.invalid',
  '{"display_name":"Monthly TD test","timezone":"Asia/Manila"}');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000301',
  'Calendar monthly', 'time-deposit', 15000000, 15000000, 600, '2020-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
select is((select (r.next_occurrence_at at time zone 'Asia/Manila')::date
  from public.recurring r join public.account a on a.interest_recurring_id = r.id
  where a.id = '00000000-0000-4000-8000-000000000302'), '2020-10-01'::date,
  'First posting is next calendar month, not opening date');
select is(public.td_monthly_net_interest_centavos(a, '2020-09-01', '2020-10-01'), 59178::bigint,
  '30 days: separately rounded gross and tax produce 591.78')
  from public.account a where id = '00000000-0000-4000-8000-000000000302';
select public.recurring_fire_due();
select is((select amount_centavos from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000302' and date = '2020-10-01'),
  59178::bigint, 'Hourly cron posts September interest on October 1');
select is((select amount_centavos from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000302' and date = '2020-11-01'),
  61392::bigint, 'October uses credited September interest and 31 days');
select is((select balance_centavos from public.account where id = '00000000-0000-4000-8000-000000000302'),
  15120570::bigint, 'Both missed periods change the balance through ledger triggers');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000302'),
  2::bigint, 'Repeated cron does not duplicate interest');
select public.td_check_maturity_due();
select ok((select is_matured and interest_recurring_id is null from public.account
  where id = '00000000-0000-4000-8000-000000000302'), 'Maturity retires schedule after final posting');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000302'),
  2::bigint, 'First-of-month maturity includes final previous month exactly once');

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000301',
  'Partial monthly', 'time-deposit', 15000000, 15000000, 600, '2020-10-15', 'monthly',
  '2020-09-16T00:00:00+08:00');
-- Delete the generated recurring to reproduce the missing schedule.
delete from public.recurring where to_account_id = '00000000-0000-4000-8000-000000000303';
select public.td_check_maturity_due();
select is((select amount_centavos from public.transaction where to_account_id =
  '00000000-0000-4000-8000-000000000303' and date = '2020-10-01'), 29589::bigint,
  'Mid-month opening only earns 15 eligible September days');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000303'),
  2::bigint, 'Missing schedule repairs and catches up including partial maturity');
select is((select max(date) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000303'),
  '2020-10-15'::date, 'Final partial period posts at maturity');
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000303'), '2020-10-15'::date,
  'Cursor never advances past maturity');

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000301',
  'Funded later', 'time-deposit', 0, 15000000, 600, '2020-03-01', 'monthly',
  '2020-01-01T00:00:00+08:00');
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select '00000000-0000-4000-8000-000000000301', 'income', id,
  '00000000-0000-4000-8000-000000000304', 15000000, '2020-02-01'
from public.tag where user_id = '00000000-0000-4000-8000-000000000301' and name = 'bonus';
select is(public.td_monthly_period_start(a), '2020-02-01'::date,
  'Internal funding starts accrual on ledger funding date') from public.account a
  where id = '00000000-0000-4000-8000-000000000304';
select public.recurring_fire_due();
select is((select amount_centavos from public.transaction where to_account_id =
  '00000000-0000-4000-8000-000000000304' and date = '2020-03-01'), 57206::bigint,
  'Leap February uses 29 actual days with fixed 365 denominator');
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000304'),
  2::bigint, 'No interest transaction before funding');

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000301',
  'Archived monthly', 'time-deposit', 15000000, 15000000, 600, '2099-01-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000305';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000305'),
  0::bigint, 'Archived monthly accounts do not post even if recurring was not paused');
select ok(not has_function_privilege('authenticated', 'public.td_post_monthly_interest_due()', 'EXECUTE'),
  'Monthly cron RPC is not callable by ordinary users');
select ok(not has_table_privilege('authenticated', 'public.td_monthly_interest_state', 'UPDATE'),
  'Users cannot modify processed-period cursor');

-- Later interest credits must not affect an earlier period’s balance.
select is(public.td_monthly_net_interest_centavos(a, '2020-09-01', '2020-10-01'), 59178::bigint,
  'Past period calculation ignores interest credited after period end') from public.account a
  where id = '00000000-0000-4000-8000-000000000302';
select ok(has_function_privilege('service_role', 'public.td_post_monthly_interest_due()', 'EXECUTE'),
  'Service role can invoke monthly processor');

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000301',
  'Preserve existing', 'time-deposit', 15000000, 15000000, 600, '2020-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select '00000000-0000-4000-8000-000000000301', 'income', id,
  '00000000-0000-4000-8000-000000000306', 60000, '2020-10-01'
from public.tag where user_id = '00000000-0000-4000-8000-000000000301' and name = 'interest-earned';
update public.recurring set is_paused = true where to_account_id = '00000000-0000-4000-8000-000000000306';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000306'),
  1::bigint, 'Paused monthly schedule does not catch up');
update public.recurring set is_paused = false where to_account_id = '00000000-0000-4000-8000-000000000306';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000306'),
  1::bigint, 'Resume skips periods intentionally paused instead of backfilling');
select is((select amount_centavos from public.transaction where to_account_id =
  '00000000-0000-4000-8000-000000000306' and date = '2020-10-01'), 60000::bigint,
  'Historical interest is preserved without recalculation');
select is(public.td_monthly_net_interest_centavos(a, '2020-10-01', '2020-11-01'),
  61395::bigint, 'Calculation compounds actual preserved historical interest')
  from public.account a where id = '00000000-0000-4000-8000-000000000306';

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000301',
  'Balance exposure', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  '2020-09-01T00:00:00+08:00');
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select '00000000-0000-4000-8000-000000000301', 'income', id,
  '00000000-0000-4000-8000-000000000307', 5000000, '2020-09-16'
from public.tag where user_id = '00000000-0000-4000-8000-000000000301' and name = 'bonus';
select is(public.td_monthly_net_interest_centavos(a, '2020-09-01', '2020-10-01'), 69041::bigint,
  'Balance changes are weighted by actual days rather than using final balance')
  from public.account a where id = '00000000-0000-4000-8000-000000000307';
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select '00000000-0000-4000-8000-000000000301', 'income', id,
  '00000000-0000-4000-8000-000000000307', 5000000, '2020-10-15'
from public.tag where user_id = '00000000-0000-4000-8000-000000000301' and name = 'bonus';
select is(public.td_monthly_net_interest_centavos(a, '2020-09-01', '2020-10-01'), 69041::bigint,
  'Transactions after the historical period do not change its interest')
  from public.account a where id = '00000000-0000-4000-8000-000000000307';
-- Avoid processing years of interest for this math-only fixture.
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000307';
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval)
values ('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000301',
  'Open today', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly');
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000308'),
  0::bigint, 'No interest is posted for an unfinished opening month');
select is((select extract(day from next_occurrence_at at time zone 'Asia/Manila')::int
  from public.recurring where to_account_id = '00000000-0000-4000-8000-000000000308'), 1,
  'New accounts schedule at local midnight on the first');

select is((select amount_centavos from public.transaction where to_account_id =
  '00000000-0000-4000-8000-000000000303' and date = '2020-10-15'), 27671::bigint,
  'Final 14-day period compounds the first partial posting');
delete from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000306'
  and date = '2020-10-01';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000306'),
  0::bigint, 'Deleting an interest transaction does not cause it to be posted again');
select is((select accrued_through from public.td_monthly_interest_state where account_id =
  '00000000-0000-4000-8000-000000000306'),
  date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Processed cursor survives transaction deletion');
insert into public.td_monthly_interest_state(account_id, accrued_through, tag_id)
select '00000000-0000-4000-8000-000000000307', '2020-09-01', id from public.tag
where user_id = '00000000-0000-4000-8000-000000000301' and name = 'interest-earned'
on conflict (account_id) do update set accrued_through = excluded.accrued_through;
insert into public.transaction(user_id, type, tag_id, to_account_id, amount_centavos, date)
select '00000000-0000-4000-8000-000000000301', 'income', id,
  '00000000-0000-4000-8000-000000000307', 50000, '2020-10-01'
from public.tag where user_id = '00000000-0000-4000-8000-000000000301' and name = 'interest-earned';
select is(public.td_monthly_period_start(a), '2020-09-01'::date,
  'Manual interest entries cannot advance an existing monthly cursor')
  from public.account a where id = '00000000-0000-4000-8000-000000000307';

update public.account set interest_posting_interval = 'quarterly'
  where id = '00000000-0000-4000-8000-000000000307';
update public.account set interest_posting_interval = 'monthly'
  where id = '00000000-0000-4000-8000-000000000307';
select is(public.td_monthly_period_start(a), '2020-10-01'::date,
  'Explicit cadence transition deliberately adopts historical interest')
  from public.account a where id = '00000000-0000-4000-8000-000000000307';

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000309', '00000000-0000-4000-8000-000000000301',
  'Rename regression', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '1 month') at time zone 'Asia/Manila');
update public.tag set name = 'deposit-yield'
  where user_id = '00000000-0000-4000-8000-000000000301' and name = 'interest-earned';
insert into public.recurring(user_id, service, amount_centavos, type, tag_id, to_account_id,
  interval, first_occurrence_date, next_occurrence_at, remaining_occurrences)
select '00000000-0000-4000-8000-000000000301', 'Unrelated recurring', 12345, 'income', id,
  '00000000-0000-4000-8000-000000000309', 'monthly', (now() at time zone 'Asia/Manila')::date, now(), 1
from public.tag where user_id = '00000000-0000-4000-8000-000000000301' and name = 'bonus';
select lives_ok('select public.recurring_fire_due()', 'Renaming interest tag does not fail hourly cron');
select is((select count(*) from public.transaction t join public.tag g on g.id = t.tag_id
  where t.to_account_id = '00000000-0000-4000-8000-000000000309' and g.name = 'deposit-yield'),
  1::bigint, 'Monthly posting uses linked recurring stable tag ID after rename');
select is((select count(*) from public.transaction where to_account_id =
  '00000000-0000-4000-8000-000000000309' and amount_centavos = 12345), 1::bigint,
  'Unrelated due recurring still fires after interest tag rename');
delete from public.recurring where to_account_id = '00000000-0000-4000-8000-000000000309';
select lives_ok('select public.recurring_fire_due()', 'Missing schedule repairs using saved renamed tag ID');
select is((select count(*) from public.recurring r join public.tag g on g.id = r.tag_id
  where r.to_account_id = '00000000-0000-4000-8000-000000000309' and g.name = 'deposit-yield'),
  1::bigint, 'Repair reuses saved tag without depending on the editable name');
-- A manually edited posting date cannot move the persisted monthly cursor.
update public.transaction set date = date + 5 where to_account_id =
  '00000000-0000-4000-8000-000000000309' and tag_id in (select id from public.tag
    where user_id = '00000000-0000-4000-8000-000000000301' and name = 'deposit-yield');
select is(public.td_monthly_period_start(a), date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Editing generated interest date cannot move the protected cursor')
  from public.account a where id = '00000000-0000-4000-8000-000000000309';
select is((select count(*) from public.tag where user_id = '00000000-0000-4000-8000-000000000301'
  and name = 'interest-earned'), 0::bigint, 'Renamed linked tags do not cause replacement tags to be created');

-- Simulate a pause spanning completed periods without relying on the hourly
-- job running during the pause. Resume itself must discard missed periods.
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000310', '00000000-0000-4000-8000-000000000301',
  'Resume future', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '2 months') at time zone 'Asia/Manila');
update public.recurring set is_paused = true where to_account_id = '00000000-0000-4000-8000-000000000310';
update public.recurring set is_paused = false where to_account_id = '00000000-0000-4000-8000-000000000310';
select public.recurring_fire_due();
select is((select count(*) from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000310'),
  0::bigint, 'Resume skips paused months even without cron running during the pause');
select is((select accrued_through from public.td_monthly_interest_state where account_id =
  '00000000-0000-4000-8000-000000000310'), date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Resume records skipped completed periods in the protected cursor');
select is((select (next_occurrence_at at time zone 'Asia/Manila')::date from public.recurring where
  to_account_id = '00000000-0000-4000-8000-000000000310'),
  (date_trunc('month', now() at time zone 'Asia/Manila') + interval '1 month')::date,
  'Resumed monthly deposits schedule the next calendar posting');
select * from finish();
rollback;
