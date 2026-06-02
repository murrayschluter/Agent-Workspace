-- supabase/auth/19_post_audit_fixes.sql
-- Post-audit HIGH fixes (issue #29, bpg-ant domain): H1, H2, H3.
-- Pure SQL (policies + one RPC). Idempotent. Apply BEFORE the Phase 6 flip,
-- re-verify on staging. RLS-target tables already exist (files 02-05/09/10).
--
-- ============================================================================
-- H1 — child-table DELETE was super_admin-only, but the UI shows delete
-- buttons to all users → a normal agent clicking "delete" gets a raw RLS
-- error post-flip.
--
-- Decision (recorded on #29): broaden DELETE to can_edit_listing for the
-- children an agent legitimately manages on their own listing — touchpoints,
-- weekly_logs, listing_services, custom_tasks. These have no protected
-- side-effects, and the insert/update policies are already can_edit_listing,
-- so DELETE matching that is consistent.
--
-- DELIBERATELY NOT broadened:
--   - documents: the storage FILE delete stays super_admin-only (anti-leaver,
--     preserved by PR #30's file 13). Broadening the row delete would orphan
--     the file. Documents delete stays super_admin-only; its UI button is
--     role-gated instead (in src/components/detail/Documents.jsx, shipped with
--     the B3 signed-URL PR).
--   - contracts: the sale contract — higher stakes, no UI delete button.
--   - stage_history: append-only by design (audit-correct).
-- ============================================================================

drop policy if exists "delete_weekly_logs" on weekly_logs;
create policy "delete_weekly_logs" on weekly_logs for delete using (
  can_edit_listing(auth.uid(), listing_id)
);

drop policy if exists "delete_touchpoints" on touchpoints;
create policy "delete_touchpoints" on touchpoints for delete using (
  can_edit_listing(auth.uid(), listing_id)
);

drop policy if exists "delete_listing_services" on listing_services;
create policy "delete_listing_services" on listing_services for delete using (
  can_edit_listing(auth.uid(), listing_id)
);

-- ============================================================================
-- H2 — standalone custom tasks (listing_id IS NULL). The table allows a null
-- listing_id and the UI offers "No specific listing", but the policies key on
-- can_read/edit_listing(uid, listing_id), which return false for a null
-- listing_id (non-admins) → agents can't create or see listing-less tasks.
--
-- Fix: add an OR branch keyed on created_by (stamped by file 18's
-- set_created_by trigger, so it's auth.uid() at WITH CHECK time — BEFORE INSERT
-- triggers fire before the RLS WITH CHECK, verified on staging). Combined here
-- with the H1 delete-broadening for custom_tasks.
-- ============================================================================

drop policy if exists "select_custom_tasks" on custom_tasks;
create policy "select_custom_tasks" on custom_tasks for select using (
  can_read_listing(auth.uid(), listing_id)
  or (listing_id is null and created_by = auth.uid())
);

drop policy if exists "insert_custom_tasks" on custom_tasks;
create policy "insert_custom_tasks" on custom_tasks for insert with check (
  can_edit_listing(auth.uid(), listing_id)
  or (listing_id is null and created_by = auth.uid())
);

drop policy if exists "update_custom_tasks" on custom_tasks;
create policy "update_custom_tasks" on custom_tasks for update using (
  can_edit_listing(auth.uid(), listing_id)
  or (listing_id is null and created_by = auth.uid())
);

drop policy if exists "delete_custom_tasks" on custom_tasks;
create policy "delete_custom_tasks" on custom_tasks for delete using (
  can_edit_listing(auth.uid(), listing_id)
  or (listing_id is null and created_by = auth.uid())
);

-- ============================================================================
-- H3 — ShareDialog's collaborator list. ShareDialog.refresh() reads
-- `listing_collaborators ... profiles!inner(email, display_name)`. Post-flip,
-- select_profiles restricts a non-admin to their OWN profile row, so the inner
-- join drops every other collaborator → the owner sees a near-empty list.
-- Same class as the #15 invite-picker, but the collaborator-list join wasn't
-- migrated.
--
-- Fix: a SECURITY DEFINER RPC returning the collaborator rows + names for a
-- listing, gated to those who legitimately MANAGE sharing — super_admin OR
-- listing owner OR co_owner collaborator (the set that can invite, per
-- insert_listing_collaborators). A viewer/editor calling it gets an empty set
-- (they don't manage sharing). This intentionally does NOT use can_read_listing
-- (which would let any collaborator enumerate the full list — the broadening
-- Murray flagged on #22).
--
-- The function GUARDS on auth.uid() (via the manage-sharing check), so anon
-- EXECUTE is benign; we still apply the spec-v10 grant hardening for
-- consistency with 14a.
-- ============================================================================

create or replace function list_listing_collaborators(p_listing_id uuid)
returns table(id uuid, user_id uuid, level collab_level, email text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select lc.id, lc.user_id, lc.level, p.email, p.display_name
  from listing_collaborators lc
  join profiles p on p.user_id = lc.user_id
  where lc.listing_id = p_listing_id
    and (
      is_super_admin(auth.uid())
      or is_listing_owner(auth.uid(), p_listing_id)
      or is_listing_co_owner(auth.uid(), p_listing_id)
    )
  order by p.email;
$$;

revoke execute on function list_listing_collaborators(uuid) from public;
revoke execute on function list_listing_collaborators(uuid) from anon;
grant execute on function list_listing_collaborators(uuid) to authenticated;
