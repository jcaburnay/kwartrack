-- Idempotent re-issue of the budget_actuals view from
-- 20260504163157_budget_actuals_view.sql. The earlier migration's CI run
-- did not apply to prod (the view query 404s, leaving every per-tag
-- "actual" stuck at ₱0 in the budget panel). Body is identical to the
-- original; CREATE OR REPLACE is a no-op when the view is already
-- present, otherwise it creates it. Safe under all states.

create or replace view public.budget_actuals
  with (security_invoker = true) as
select
  t.user_id,
  to_char(t.date, 'YYYY-MM') as month,
  t.tag_id,
  sum(coalesce(s.user_share_centavos, t.amount_centavos))::bigint as actual_centavos
from public.transaction t
left join public.split_event s on s.id = t.split_id
where t.type = 'expense'
  and t.parent_transaction_id is null
group by t.user_id, to_char(t.date, 'YYYY-MM'), t.tag_id;
