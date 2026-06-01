-- supabase/auth/20_fix_demotion_toctou.sql
-- Audit #29 M2 — fix the TOCTOU race in prevent_last_super_admin_demotion.
--
-- The guard's original serialisation used:
--   perform 1 from profiles where role='super_admin' and user_id <> old.user_id for update;
-- i.e. it locked the OTHER super_admin rows. But two concurrent demotions of
-- DIFFERENT super_admins lock disjoint row sets:
--   - Tx1 (demote A) locks {B}, counts others = {B} = 1 → proceeds
--   - Tx2 (demote B) locks {A}, counts others = {A} = 1 → proceeds
-- They never contend (disjoint locks), both commit → ZERO super_admins → full
-- lockout. Narrow (needs two concurrent admin demotions) but real.
--
-- Fix: serialise ALL demotions on a single transaction-scoped advisory lock
-- keyed on a constant. The second demotion blocks until the first commits,
-- then re-reads the now-reduced count and correctly raises. Replaces the
-- disjoint FOR UPDATE (which gave false confidence).
--
-- Idempotent (CREATE OR REPLACE). SECURITY INVOKER (unchanged) — the trigger
-- runs in the caller's context; the advisory lock is connection/txn-scoped and
-- needs no elevated privilege.

create or replace function prevent_last_super_admin_demotion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  other_super_admin_count int;
begin
  if old.role = 'super_admin' and new.role <> 'super_admin' then
    -- Serialise ALL super_admin demotions on one transaction-scoped advisory
    -- lock. Constant key (not per-row), so concurrent demotions of different
    -- admins actually contend: the second waits for the first to COMMIT, then
    -- re-reads the reduced count below and blocks if it would hit zero.
    perform pg_advisory_xact_lock(hashtext('super_admin_demotion'));

    select count(*) into other_super_admin_count from profiles
      where role = 'super_admin' and user_id <> old.user_id;

    if other_super_admin_count = 0 then
      raise exception 'Cannot demote the last super_admin. Promote another super_admin first.';
    end if;
  end if;
  return new;
end;
$$;
