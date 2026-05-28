-- supabase/auth/12_rls_admin_log.sql
-- Audit log: INSERT-only by anyone (the API enforces what gets inserted),
-- SELECT super_admin only, no UPDATE or DELETE for anyone.

drop policy if exists "select_admin_access_log" on admin_access_log;
create policy "select_admin_access_log" on admin_access_log for select using (
  is_super_admin(auth.uid())
);

-- INSERT is open to any authenticated user — the /api/log-admin-view function
-- writes here and it's called from React; we don't want a service-role to write
-- this. We rely on the API to validate the payload.
drop policy if exists "insert_admin_access_log" on admin_access_log;
create policy "insert_admin_access_log" on admin_access_log for insert with check (
  auth.uid() = viewer_user_id
);

-- No UPDATE policy — immutable.
-- No DELETE policy — immutable.
