-- supabase/auth/14_invite_picker_rpc.sql
-- Phase 6 prerequisite per spec v9: ShareDialog's invite picker needs to
-- read other profiles to populate the dropdown. Once Phase 6 enables RLS
-- on `profiles`, the `select_profiles` policy restricts reads to "self or
-- super_admin" — leaving the picker empty for non-super_admin owners.
--
-- This RPC exposes only the three columns the picker needs (user_id,
-- email, display_name) for agents + super_admins. `role` and
-- `vault_user_id` stay invisible to non-admins. Pending users are
-- intentionally excluded — an unactivated account shouldn't appear as
-- invitable yet.
--
-- Same hardening pattern as the helpers in 06_helpers.sql: STABLE +
-- SECURITY DEFINER + pinned search_path. Caller is `authenticated`
-- (Supabase Auth's default role for any signed-in user).
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
  ORDER BY email;
$$;

-- Allow any signed-in user to call this. The function itself enforces what
-- they see (only agents + super_admins; only three columns).
GRANT EXECUTE ON FUNCTION list_invitable_profiles() TO authenticated;
