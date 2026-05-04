-- Per-user, per-month, per-tag aggregated expense centavos. Replaces the
-- client-side rollups that useBudget, useBudgetOverage, and useBudgetHistory
-- each did over their own copy of the transaction list — three hooks were
-- pulling overlapping transaction queries and bucketing in JS.
--
-- Split-linked rows count only the user's share (split_event.user_share_centavos);
-- non-split rows count their full amount_centavos. Mirrors the JS effective-share
-- math the hooks did before. parent_transaction_id is null filters out
-- transfer-fee child rows for safety; the type='expense' filter already does
-- that in practice.
--
-- security_invoker = true makes the view run with the caller's privileges, so
-- RLS on transaction (transaction_select_own) auto-filters to auth.uid().

create view public.budget_actuals
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
