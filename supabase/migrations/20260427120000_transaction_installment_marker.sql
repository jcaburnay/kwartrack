-- Slice 11: snapshot installment-vs-subscription classification on the
-- transaction itself, so the credit-card `availableCredit` formula can
-- subtract the installment-linked portion of balance from the regular pool
-- (spec §216) without depending on a JOIN that the recurring may have
-- changed shape under (subscription→installment edits, or recurring delete
-- which sets recurring_id back to null).

alter table public.transaction
  add column is_installment_portion boolean not null default false;

-- Backfill from the current state of `recurring`. Any past transaction whose
-- source recurring is currently an installment (remaining_occurrences IS NOT
-- NULL) gets marked. This intentionally also marks transactions from
-- *completed* installments (remaining_occurrences = 0) — a paid-off
-- installment whose card balance hasn't been paid down still ties up the
-- regular credit pool until the balance comes down. Edge case: a
-- subscription that was later edited to become an installment will
-- retroactively reclassify all its prior expenses; this is rare and
-- acceptable.
update public.transaction t
   set is_installment_portion = true
  from public.recurring r
 where t.recurring_id = r.id
   and r.remaining_occurrences is not null;

-- Re-create recurring_fire_due() to set is_installment_portion at fire time.
-- Snapshot at fire time, not derived later, so the classification survives
-- recurring deletion and subscription↔installment edits on the recurring.
create or replace function public.recurring_fire_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_fired int := 0;
  v_tz text;
  v_local_date date;
  v_next timestamptz;
  v_remaining int;
  v_completed boolean;
  v_is_installment boolean;
begin
  for r in
    select * from public.recurring
     where is_paused = false
       and is_completed = false
       and next_occurrence_at <= now()
     for update skip locked
  loop
    select timezone into v_tz from public.user_profile where id = r.user_id;
    if v_tz is null then v_tz := 'Asia/Manila'; end if;

    v_next := r.next_occurrence_at;
    v_remaining := r.remaining_occurrences;
    v_completed := false;
    v_is_installment := r.remaining_occurrences is not null;

    while v_next <= now() and not v_completed loop
      v_local_date := (v_next at time zone v_tz)::date;

      insert into public.transaction
        (user_id, amount_centavos, type, tag_id, from_account_id,
         to_account_id, fee_centavos, description, date, recurring_id,
         is_installment_portion)
      values
        (r.user_id, r.amount_centavos, r.type, r.tag_id, r.from_account_id,
         r.to_account_id, r.fee_centavos, r.description, v_local_date, r.id,
         v_is_installment);

      v_fired := v_fired + 1;

      if v_remaining is not null then
        v_remaining := v_remaining - 1;
        if v_remaining = 0 then
          update public.recurring set
            remaining_occurrences = 0,
            is_completed = true,
            completed_at = now(),
            next_occurrence_at = v_next
          where id = r.id;
          v_completed := true;
        end if;
      end if;

      if not v_completed then
        v_next := public.advance_recurring_next(
          r.first_occurrence_date, r.interval, v_next, v_tz
        );
      end if;
    end loop;

    if not v_completed then
      update public.recurring set
        remaining_occurrences = v_remaining,
        next_occurrence_at = v_next
      where id = r.id;
    end if;
  end loop;

  return v_fired;
end;
$$;
