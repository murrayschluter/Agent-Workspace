-- supabase/auth/14a_invite_picker_rpc.sql
-- Phase 6 prerequisite per spec v9: ShareDialog's invite picker needs to
-- read other profiles to populate the dropdown. Once Phase 6 enables RLS
-- on `profiles`, the `select_profiles` policy restricts reads to "self or
-- super_admin" — leaving the picker empty for non-super_admin owners.
--
-- This RPC exposes only the three columns the picker needs (user_id,
-- email, display_name) for agents + super_admins. `role` and
-- `vault_user_id` stay invisible to non-admins. Pending profiles in the
-- result set are intentionally excluded — an unactivated account
-- shouldn't appear as invitable yet.
--
-- File numbering note (per Murray's PR #15 review): `14_` is reserved for
-- the Phase 5 owner_id backfill (referenced in `01_enums.sql` and
-- `13_rls_storage.sql` comments). This RPC slots in as `14a_` to apply
-- AFTER the backfill but BEFORE `15_enable_rls.sql`. There is no
-- functional dependency on the backfill — the suffix just preserves
-- numeric-sort apply ordering without requiring a renumber of the merged
-- comments.
--
-- Same hardening pattern as the helpers in 06_helpers.sql: STABLE +
-- SECURITY DEFINER + pinned search_path. Caller is `authenticated`
-- (Supabase Auth's default role for any signed-in user).
--
-- Caller-role guard (added per Murray's PR #15 minor flag): without it,
-- a `pending` @blacpg user — gated to the awaiting-access screen by the
-- AuthGate — could still hit this RPC directly via PostgREST and
-- enumerate every active agent/super_admin email. Low sensitivity for
-- an internal tool, but defense-in-depth: short-circuit to empty set
-- unless the caller is themselves agent or super_admin. The EXISTS
-- subquery runs once per call (constant relative to the outer query),
-- so Postgres folds it into the plan as a one-shot filter.
--
-- ShareDialog migrates from supabase.from('profiles').select(...) to
-- supabase.rpc('list_invitable_profiles'). Same return shape; client-side
-- de-duplication (filter out current user, owner, existing collaborators)
-- is unchanged.

CREATE OR REPLACE FUNCTION list_invitable_profiles()
RETURNS TABLE(user_id uuid, email text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, email, display_name
  FROM profiles
  WHERE role IN ('agent', 'super_admin')
    AND EXISTS (
      SELECT 1 FROM profiles caller
      WHERE caller.user_id = auth.uid()
        AND caller.role IN ('agent', 'super_admin')
    )
  ORDER BY email;
$$;

-- Tighten the EXECUTE grant. The default Postgres + Supabase grants land
-- EXECUTE on PUBLIC, anon, authenticated, postgres, AND service_role. With
-- this function being SECURITY DEFINER, an anon caller could otherwise
-- read every agent / super_admin profile by hitting the RPC. The caller-
-- role guard above closes most of the gap, but anon has no profile row at
-- all, so anon EXECUTE is still wasteful (always returns empty). Revoke
-- from PUBLIC AND from anon explicitly — REVOKE FROM PUBLIC alone is not
-- enough because Supabase grants anon EXECUTE on functions via a default-
-- privileges hook (separate from PUBLIC).
REVOKE EXECUTE ON FUNCTION list_invitable_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION list_invitable_profiles() FROM anon;
GRANT EXECUTE ON FUNCTION list_invitable_profiles() TO authenticated;
-- service_role retains the default grant — it can call anything, and the
-- sync function / serverless backends need that.
