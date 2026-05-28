-- supabase/auth/03_listing_collaborators.sql
-- Per-listing collaboration grants. A user is invited at a specific level.

create table if not exists listing_collaborators (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  level       collab_level not null,
  -- Audit-ish field: the grant survives even if the inviter is later deleted.
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (listing_id, user_id)
);

create index if not exists listing_collaborators_user_idx    on listing_collaborators (user_id);
create index if not exists listing_collaborators_listing_idx on listing_collaborators (listing_id);

alter table listing_collaborators disable row level security;
