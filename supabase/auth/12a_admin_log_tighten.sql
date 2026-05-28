-- supabase/auth/12a_admin_log_tighten.sql
-- Defense-in-depth tightening of admin_access_log INSERT policy.
--
-- Per Murray's PR #12 review: the original policy in 12_rls_admin_log.sql
-- (`with check (auth.uid() = viewer_user_id)`) prevents identity forging —
-- a non-admin can't write a log row attributed to someone else — but it
-- doesn't restrict the action itself. A non-admin authenticated agent could
-- still POST to /api/log-admin-view (or insert directly via PostgREST) and
-- pollute the admin audit log with misleading entries attributed to
-- themselves. Every action in the API's ALLOWED_ACTIONS set is a
-- super_admin-only operation, so callers without super_admin role have
-- no legitimate reason to write to this table.
--
-- /api/log-admin-view now gates on is_super_admin at the application layer;
-- this file mirrors the same constraint at the DB layer so a direct INSERT
-- (e.g. via the supabase-js client, bypassing the endpoint) is also rejected.
--
-- File numbering: 12a_ slots in immediately after 12_rls_admin_log.sql,
-- before 13_rls_storage.sql. Applies in numeric order with the rest of the
-- auth chain.

drop policy if exists "insert_admin_access_log" on admin_access_log;
create policy "insert_admin_access_log" on admin_access_log for insert
  with check (
    auth.uid() = viewer_user_id
    and is_super_admin(auth.uid())
  );
