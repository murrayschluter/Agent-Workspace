-- supabase/auth/04_admin_access_log.sql
-- Audit log for admin override AND destructive actions.
-- INSERT-only at the RLS layer once policies land (file 12). No updates, no deletes.

create table if not exists admin_access_log (
  id                uuid primary key default gen_random_uuid(),
  viewer_user_id    uuid not null references auth.users(id),
  viewed_user_id    uuid references auth.users(id),
  viewed_listing_id uuid references listings(id),
  action            text not null,
  details           jsonb,
  accessed_at       timestamptz not null default now()
);

-- Recognised action values (text not enum, so future actions can be added without migration):
--   enter_admin_mode, exit_admin_mode, view_as, view_listing, admin_search,
--   delete_listing, delete_child_record, deactivate_user, reassign_owner, role_change

create index if not exists admin_access_log_viewer_idx
  on admin_access_log (viewer_user_id, accessed_at desc);
create index if not exists admin_access_log_viewed_user_idx
  on admin_access_log (viewed_user_id, accessed_at desc);

alter table admin_access_log disable row level security;
