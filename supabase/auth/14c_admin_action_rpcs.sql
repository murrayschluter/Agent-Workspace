-- supabase/auth/14c_admin_action_rpcs.sql
-- Atomic RPCs for super_admin user-management actions.
--
-- Per Murray's PR #14 review: the original flow was `profiles.update(...)`
-- followed by a separate POST to `/api/log-admin-view`. If the audit POST
-- failed (network blip, server error), the role change persisted with no
-- audit entry — leaving a privileged action un-audited. Best-effort
-- logging is fine for low-stakes actions, but role changes and
-- deactivations are exactly the actions an audit trail exists for.
--
-- These RPCs wrap mutation + audit in a single transaction. Either both
-- happen, or neither does. SECURITY DEFINER + super_admin gate matches
-- the API endpoint, but enforces server-side regardless of how the call
-- reaches Postgres.
--
-- The pre-existing `prevent_last_super_admin_demotion` trigger still
-- fires on the UPDATE (triggers run inside SECURITY DEFINER calls), so
-- the catastrophic-demote protection remains intact.
--
-- File numbering: 14c_ slots between 14b_vault_rls.sql and the eventual
-- 15_enable_rls.sql.

-- change_user_role: super_admin updates target's role + audits.
create or replace function change_user_role(
  target_user_id uuid,
  new_role text,
  previous_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'super_admin only' using errcode = '42501';
  end if;

  if new_role not in ('pending', 'agent', 'super_admin') then
    raise exception 'invalid role: %', new_role using errcode = '22023';
  end if;

  update profiles set role = new_role where user_id = target_user_id;
  if not found then
    raise exception 'profile not found: %', target_user_id using errcode = 'P0002';
  end if;

  insert into admin_access_log (viewer_user_id, viewed_user_id, action, details)
  values (
    auth.uid(),
    target_user_id,
    'role_change',
    jsonb_build_object(
      'previous_role', previous_role,
      'new_role', new_role,
      'target_user_id', target_user_id
    )
  );
end;
$$;

revoke execute on function change_user_role(uuid, text, text) from public;
revoke execute on function change_user_role(uuid, text, text) from anon;
grant execute on function change_user_role(uuid, text, text) to authenticated;

-- deactivate_user: super_admin demotes target to 'pending' + audits.
-- Separate from change_user_role because the audit action label differs
-- and because the function explicitly blocks self-deactivation (matching
-- the UI's disabled button on self rows).
create or replace function deactivate_user(
  target_user_id uuid,
  previous_role text,
  target_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'super_admin only' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot deactivate self' using errcode = '22023';
  end if;

  update profiles set role = 'pending' where user_id = target_user_id;
  if not found then
    raise exception 'profile not found: %', target_user_id using errcode = 'P0002';
  end if;

  insert into admin_access_log (viewer_user_id, viewed_user_id, action, details)
  values (
    auth.uid(),
    target_user_id,
    'deactivate_user',
    jsonb_build_object(
      'previous_role', previous_role,
      'target_user_id', target_user_id,
      'email', target_email
    )
  );
end;
$$;

revoke execute on function deactivate_user(uuid, text, text) from public;
revoke execute on function deactivate_user(uuid, text, text) from anon;
grant execute on function deactivate_user(uuid, text, text) to authenticated;
