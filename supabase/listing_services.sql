-- =============================================================================
-- Service providers per listing — photographer, signboard, conveyancer, etc.
-- Run AFTER the earlier SQL files in the Supabase SQL editor.
-- Idempotent — safe to re-run.
-- =============================================================================

do $$ begin
  create type service_type as enum (
    'photographer',
    'signboard',
    'conveyancer',
    'building_inspector',
    'marketing',
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists listing_services (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references listings(id) on delete cascade,
  service_type      service_type not null default 'other',
  provider_name     text,
  provider_contact  text,
  scheduled_for     date,
  completed_at      date,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists listing_services_listing_idx
  on listing_services (listing_id);

alter table listing_services disable row level security;
