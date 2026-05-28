-- supabase/auth/05_listings_ownership.sql
-- Add ownership + audit columns to listings and child tables.
-- Existing rows will have NULL owner_id until backfill (file 14).
-- This file is purely additive; safe to run in production at any time.

alter table listings
  add column if not exists owner_id    uuid references auth.users(id),
  add column if not exists created_by  uuid references auth.users(id),
  add column if not exists updated_by  uuid references auth.users(id);

create index if not exists listings_owner_idx on listings (owner_id);

alter table weekly_logs       add column if not exists created_by uuid references auth.users(id);
alter table contracts         add column if not exists created_by uuid references auth.users(id);
alter table touchpoints       add column if not exists created_by uuid references auth.users(id);
alter table documents         add column if not exists created_by uuid references auth.users(id);
alter table custom_tasks      add column if not exists created_by uuid references auth.users(id);
alter table listing_services  add column if not exists created_by uuid references auth.users(id);
