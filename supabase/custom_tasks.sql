-- =============================================================================
-- Custom tasks + scratch notes for daily friction reducers.
-- Run AFTER schema.sql / triggers.sql / documents.sql in the Supabase SQL editor.
-- Idempotent — safe to re-run.
-- =============================================================================

-- Scratch notes column on listings (free-form per-listing jottings)
alter table listings add column if not exists scratch_notes text;

-- One-off to-do items, optionally linked to a listing.
-- Snooze = update due_date (no separate column needed).
-- Complete = set completed_at.
create table if not exists custom_tasks (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references listings(id) on delete cascade,
  title         text not null,
  due_date      date not null default current_date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- Partial index: open tasks (the only ones we query for the Today list)
create index if not exists custom_tasks_due_idx
  on custom_tasks (due_date) where completed_at is null;

alter table custom_tasks disable row level security;
