begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(22);

insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000501', 'monthly-review@example.invalid',
  '{"display_name":"Review regression","timezone":"Asia/Manila"}');
insert into public.tag(user_id, name, type)
values ('00000000-0000-4000-8000-000000000501', 'custom-yield', 'income');
insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000501',
  'Archived monthly', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '1 month') at time zone 'Asia/Manila');
select ok((select interest_recurring_id is not null from public.account
  where id = '00000000-0000-4000-8000-000000000502'),
  'Monthly account has a generated schedule');
update public.account set is_archived = true where id = '00000000-0000-4000-8000-000000000502';
select ok((select not r.is_paused from public.recurring r join public.account a
  on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000502'),
  'Archive gates the account without mutating the recurring pause');
select public.recurring_fire_due();
select is((select count(*) from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000502'), 0::bigint,
  'Archived account does not post monthly interest');
update public.account set is_archived = false where id = '00000000-0000-4000-8000-000000000502';
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000502'),
  date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Unarchive skips completed archived months');
select public.recurring_fire_due();
select is((select count(*) from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000502'), 0::bigint,
  'Unarchive does not backfill archived interest');

-- The app acts as authenticated; direct API calls must obey the same boundary.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
select throws_ok($$delete from public.recurring where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000502')$$,
  'P0001', 'Pause this generated interest schedule instead of deleting it',
  'Authenticated user cannot delete a generated monthly schedule');
select throws_ok($$update public.recurring set amount_centavos = amount_centavos + 1
  where id = (select interest_recurring_id from public.account
    where id = '00000000-0000-4000-8000-000000000502')$$,
  'P0001', 'Calculated monthly interest schedule fields cannot be edited',
  'Authenticated user cannot edit a calculated interest amount');
select throws_ok($$update public.account set interest_recurring_id = null
  where id = '00000000-0000-4000-8000-000000000502'$$,
  'P0001', 'Generated interest schedule links cannot be edited',
  'Authenticated user cannot detach the schedule backlink');
select throws_ok($$update public.account set is_matured = true
  where id = '00000000-0000-4000-8000-000000000502'$$,
  'P0001', 'Monthly time deposit maturity is managed automatically',
  'Authenticated user cannot mark the deposit matured to bypass posting');
select throws_ok($$update public.account set interest_posting_interval = 'at-maturity',
  interest_recurring_id = null where id = '00000000-0000-4000-8000-000000000502'$$,
  'P0001', 'Generated interest schedule links cannot be edited',
  'Cadence change cannot be combined with a backlink edit to orphan the schedule');
select lives_ok($$update public.recurring set tag_id = (select id from public.tag
  where name = 'custom-yield' and user_id = '00000000-0000-4000-8000-000000000501'),
  description = 'Bank interest', remaining_occurrences = 1
  where id = (select interest_recurring_id from public.account
    where id = '00000000-0000-4000-8000-000000000502')$$,
  'Authenticated user can edit tag, description, and occurrence limit');
reset role;
select is((select name from public.tag where id = (select r.tag_id from public.recurring r
  join public.account a on a.interest_recurring_id = r.id
  where a.id = '00000000-0000-4000-8000-000000000502')),
  'custom-yield', 'Edited tag remains on the only authoritative schedule row');

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval, created_at)
values ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000501',
  'Posting controls', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'monthly',
  (date_trunc('month', now() at time zone 'Asia/Manila') - interval '1 month') at time zone 'Asia/Manila');
update public.recurring set
  tag_id = (select id from public.tag where user_id = '00000000-0000-4000-8000-000000000501'
    and name = 'custom-yield'),
  description = 'Credited by bank', remaining_occurrences = 1
where id = (select interest_recurring_id from public.account
  where id = '00000000-0000-4000-8000-000000000503');
select public.recurring_fire_due();
select is((select count(*) from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000503'), 1::bigint,
  'Hourly processor posts the one completed monthly period');
select is((select date from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000503'),
  date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Monthly interest posts on the first day of the following month');
select is((select t.description from public.transaction t
  where t.to_account_id = '00000000-0000-4000-8000-000000000503'),
  'Credited by bank', 'Posting uses the saved description');
select is((select g.name from public.transaction t join public.tag g on g.id = t.tag_id
  where t.to_account_id = '00000000-0000-4000-8000-000000000503'),
  'custom-yield', 'Posting uses the saved tag');
select ok((select r.is_completed and r.remaining_occurrences = 0 from public.recurring r
  join public.account a on a.interest_recurring_id = r.id
  where a.id = '00000000-0000-4000-8000-000000000503'),
  'Occurrence limit completes the schedule');
delete from public.transaction where to_account_id = '00000000-0000-4000-8000-000000000503';
select public.recurring_fire_due();
select is((select count(*) from public.transaction
  where to_account_id = '00000000-0000-4000-8000-000000000503'), 0::bigint,
  'Deleting credited interest never rewinds the paid-period cursor');
select is((select accrued_through from public.td_monthly_interest_state
  where account_id = '00000000-0000-4000-8000-000000000503'),
  date_trunc('month', now() at time zone 'Asia/Manila')::date,
  'Protected cursor survives deletion of a credited transaction');

insert into public.account(id, user_id, name, type, initial_balance_centavos,
  principal_centavos, interest_rate_bps, maturity_date, interest_posting_interval)
values
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000501',
   'Quarterly legacy', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'quarterly'),
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000501',
   'At maturity legacy', 'time-deposit', 15000000, 15000000, 600, '2099-11-01', 'at-maturity');
select is((select r.amount_centavos from public.recurring r join public.account a
  on a.interest_recurring_id = r.id where a.id = '00000000-0000-4000-8000-000000000504'),
  180000::bigint, 'Quarterly retains fixed principal-based net amount');
select ok((select interest_recurring_id is null from public.account
  where id = '00000000-0000-4000-8000-000000000505'),
  'At-maturity still has no periodic schedule');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
select throws_ok($$delete from public.recurring where id = (select interest_recurring_id
  from public.account where id = '00000000-0000-4000-8000-000000000504')$$,
  'P0001', 'Pause this generated interest schedule instead of deleting it',
  'Generated schedules remain protected during cadence transitions');
reset role;
select * from finish();
rollback;
