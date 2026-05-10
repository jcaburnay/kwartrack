-- Drop the separate-installment-pool column. The "BPI Madness style" feature
-- (a distinct credit limit for installments, displayed as a second utilization
-- bar) is being removed; nothing in app code references it after this PR, and
-- a prod check confirmed zero non-null values before the drop.
--
-- The transaction.is_installment_portion column stays — it is auto-maintained
-- by recurring_fire_due() and may yet be useful for future installment-spend
-- filtering. Read paths in app code are gone after this PR.

-- Postgres implicitly drops the multi-column `account_type_fields_match` CHECK
-- when this column is dropped, since the CHECK references it. Re-create that
-- CHECK in its installment-free form so type-specific field invariants
-- (credit→creditLimit; time-deposit→principal/rate/maturity; cash et al.→none)
-- continue to be enforced at the DB level, not just by app code.

alter table public.account drop column if exists installment_limit_centavos;

alter table public.account add constraint account_type_fields_match check (
  (type = 'credit' and
     credit_limit_centavos is not null and credit_limit_centavos > 0 and
     principal_centavos is null and interest_rate_bps is null and
     maturity_date is null and interest_posting_interval is null)
  or
  (type = 'time-deposit' and
     principal_centavos is not null and principal_centavos > 0 and
     interest_rate_bps is not null and interest_rate_bps > 0 and
     maturity_date is not null and
     interest_posting_interval is not null and
     initial_balance_centavos = principal_centavos and
     credit_limit_centavos is null)
  or
  (type in ('cash', 'e-wallet', 'savings') and
     credit_limit_centavos is null and
     principal_centavos is null and interest_rate_bps is null and
     maturity_date is null and interest_posting_interval is null)
);
