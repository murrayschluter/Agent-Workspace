-- supabase/auth/11_rls_profiles.sql

-- SELECT: super_admin sees all profiles; agents see only their own.
drop policy if exists "select_profiles" on profiles;
create policy "select_profiles" on profiles for select using (
  is_super_admin(auth.uid()) or user_id = auth.uid()
);

-- INSERT: only via the provision_profile trigger (SECURITY DEFINER bypasses RLS).
-- No direct INSERT policy needed — there's no human surface that inserts profiles.
-- (We do NOT add an INSERT policy. Direct attempts will fail.)

-- UPDATE: super_admin can change role + display_name; users can only change display_name.
-- Use a column-level approach: full UPDATE access for super_admin; restricted for others.
drop policy if exists "update_profiles_super_admin" on profiles;
create policy "update_profiles_super_admin" on profiles for update using (
  is_super_admin(auth.uid())
);

drop policy if exists "update_profiles_self_display_name" on profiles;
create policy "update_profiles_self_display_name" on profiles for update using (
  user_id = auth.uid()
) with check (
  -- self-update may only change display_name (role and other columns must stay the same)
  user_id = auth.uid()
);

-- Note: enforcing "self can only update display_name" at the policy level is awkward in
-- standard Postgres RLS. The pragmatic approach is to ALSO add a trigger that rejects
-- non-display_name changes when the actor is not super_admin. Adding that here:

create or replace function prevent_self_role_change()
returns trigger
language plpgsql
as $$
begin
  if not is_super_admin(auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'Only super_admin can change role.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is not user-editable.';
    end if;
    if new.vault_user_id is distinct from old.vault_user_id then
      raise exception 'vault_user_id is not user-editable.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_change on profiles;
create trigger profiles_prevent_self_role_change
  before update on profiles
  for each row execute function prevent_self_role_change();

-- DELETE: super_admin only.
drop policy if exists "delete_profiles" on profiles;
create policy "delete_profiles" on profiles for delete using (
  is_super_admin(auth.uid())
);
