-- =============================================================================
-- Documents: per-listing file storage.
-- Run AFTER schema.sql and triggers.sql in the Supabase SQL editor.
-- Idempotent — safe to re-run.
-- =============================================================================

-- 1. Category enum
do $$ begin
  create type document_category as enum (
    'open_home_report',
    'form_6',
    'building_pest',
    'contract',
    'other'
  );
exception when duplicate_object then null; end $$;

-- 2. Documents metadata table.
-- Files themselves live in Supabase Storage (bucket: listing-documents).
-- storage_path is the path inside the bucket, e.g. "<listing_id>/<uuid>.pdf".
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  category      document_category not null default 'other',
  filename      text not null,
  mime_type     text,
  storage_path  text not null,
  size_bytes    int,
  uploaded_at   timestamptz not null default now()
);

create index if not exists documents_listing_idx
  on documents (listing_id, uploaded_at desc);

alter table documents disable row level security;

-- 3. Storage bucket: listing-documents
-- public = true means files are readable by anyone with the URL (which is a
-- random UUID, effectively unguessable). Matches our V1 trust model
-- (RLS disabled, single user, anon key in browser).
insert into storage.buckets (id, name, public, file_size_limit)
values ('listing-documents', 'listing-documents', true, 10485760) -- 10 MB
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760;

-- 4. Storage policies: allow all operations on this bucket via the anon key.
-- (SELECT is implicit for public buckets but we add it explicitly for clarity.)
drop policy if exists "listing_documents_all" on storage.objects;
create policy "listing_documents_all" on storage.objects
  for all
  using (bucket_id = 'listing-documents')
  with check (bucket_id = 'listing-documents');
