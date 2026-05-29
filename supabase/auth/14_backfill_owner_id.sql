-- supabase/auth/14_backfill_owner_id.sql
-- Phase 5: backfill owner_id on pre-existing listings.
--
-- The Listing Portal was single-user before the auth/RBAC work, so every
-- listing that predates ownership has owner_id IS NULL. After the Phase 6
-- RLS flip (15_enable_rls.sql), the listings SELECT policy (08) matches
-- `owner_id = auth.uid()`, so any listing left with NULL owner_id becomes
-- invisible to every non-super_admin. This assigns those orphan listings to
-- the original owner; a super_admin can reassign individual listings later
-- via the admin "reassign owner" flow.
--
-- !! ORDER EXCEPTION — do NOT run this during the initial numeric schema
-- apply. It needs a real profile row to point owner_id at, so run it AFTER
-- the super_admin profile is bootstrapped and BEFORE 15_enable_rls.sql.
--
-- Strategy: assign all orphan listings to the single super_admin (the
-- original sole user). Guarded so it refuses to guess if there is not
-- exactly one super_admin — in that case, edit this file to set owners
-- explicitly (or do per-agent assignment) rather than dumping everything
-- on one account.

do $$
declare
  v_owner  uuid;
  v_admins int;
  v_fixed  int;
begin
  select count(*) into v_admins from profiles where role = 'super_admin';
  if v_admins <> 1 then
    raise exception
      'Backfill expects exactly one super_admin to inherit orphan listings (found %). If listings should be split across agents, edit this file to assign owners explicitly.',
      v_admins;
  end if;

  select user_id into v_owner from profiles where role = 'super_admin' limit 1;

  update listings set owner_id = v_owner where owner_id is null;
  get diagnostics v_fixed = row_count;
  raise notice 'Backfilled owner_id on % listing(s) -> %', v_fixed, v_owner;

  -- created_by / updated_by are audit columns (not used by RLS); backfill
  -- them to the same owner where null, for consistency.
  update listings
     set created_by = coalesce(created_by, v_owner),
         updated_by = coalesce(updated_by, v_owner)
   where created_by is null or updated_by is null;
end $$;

-- Verify (run separately) — expect 0:
--   select count(*) from listings where owner_id is null;
