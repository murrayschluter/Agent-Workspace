-- supabase/auth/09_rls_children.sql
-- Child tables inherit access from the parent listing.
-- DELETE is super_admin only across the board (anti-leaver safety).

-- weekly_logs
drop policy if exists "select_weekly_logs" on weekly_logs;
create policy "select_weekly_logs" on weekly_logs for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_weekly_logs" on weekly_logs;
create policy "insert_weekly_logs" on weekly_logs for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "update_weekly_logs" on weekly_logs;
create policy "update_weekly_logs" on weekly_logs for update using (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_weekly_logs" on weekly_logs;
create policy "delete_weekly_logs" on weekly_logs for delete using (
  is_super_admin(auth.uid())
);

-- contracts
drop policy if exists "select_contracts" on contracts;
create policy "select_contracts" on contracts for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_contracts" on contracts;
create policy "insert_contracts" on contracts for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "update_contracts" on contracts;
create policy "update_contracts" on contracts for update using (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_contracts" on contracts;
create policy "delete_contracts" on contracts for delete using (
  is_super_admin(auth.uid())
);

-- touchpoints
drop policy if exists "select_touchpoints" on touchpoints;
create policy "select_touchpoints" on touchpoints for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_touchpoints" on touchpoints;
create policy "insert_touchpoints" on touchpoints for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "update_touchpoints" on touchpoints;
create policy "update_touchpoints" on touchpoints for update using (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_touchpoints" on touchpoints;
create policy "delete_touchpoints" on touchpoints for delete using (
  is_super_admin(auth.uid())
);

-- stage_history (insert-only by app logic; super_admin manual delete only)
drop policy if exists "select_stage_history" on stage_history;
create policy "select_stage_history" on stage_history for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_stage_history" on stage_history;
create policy "insert_stage_history" on stage_history for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_stage_history" on stage_history;
create policy "delete_stage_history" on stage_history for delete using (
  is_super_admin(auth.uid())
);

-- documents (rows are metadata; the actual file lives in storage, policied in file 13)
drop policy if exists "select_documents" on documents;
create policy "select_documents" on documents for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_documents" on documents;
create policy "insert_documents" on documents for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "update_documents" on documents;
create policy "update_documents" on documents for update using (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_documents" on documents;
create policy "delete_documents" on documents for delete using (
  is_super_admin(auth.uid())
);

-- custom_tasks
drop policy if exists "select_custom_tasks" on custom_tasks;
create policy "select_custom_tasks" on custom_tasks for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_custom_tasks" on custom_tasks;
create policy "insert_custom_tasks" on custom_tasks for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "update_custom_tasks" on custom_tasks;
create policy "update_custom_tasks" on custom_tasks for update using (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_custom_tasks" on custom_tasks;
create policy "delete_custom_tasks" on custom_tasks for delete using (
  is_super_admin(auth.uid())
);

-- listing_services
drop policy if exists "select_listing_services" on listing_services;
create policy "select_listing_services" on listing_services for select using (
  can_read_listing(auth.uid(), listing_id)
);
drop policy if exists "insert_listing_services" on listing_services;
create policy "insert_listing_services" on listing_services for insert with check (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "update_listing_services" on listing_services;
create policy "update_listing_services" on listing_services for update using (
  can_edit_listing(auth.uid(), listing_id)
);
drop policy if exists "delete_listing_services" on listing_services;
create policy "delete_listing_services" on listing_services for delete using (
  is_super_admin(auth.uid())
);
