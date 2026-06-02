-- supabase/auth/13_rls_storage.sql
-- Storage policies for the listing-documents bucket.
-- File path convention: {listing_id}/{filename}   (NO "listings/" prefix)
--   This matches what the app actually writes — src/lib/documents.js:
--     const storagePath = `${listingId}/${crypto.randomUUID()}.${ext}`
--   and the base schema (supabase/documents.sql): "<listing_id>/<uuid>.pdf".
--
-- IMPORTANT APPLY ORDERING — this file is NOT dormant the way files 08-12 are.
-- storage.objects has RLS ENABLED BY DEFAULT in Supabase, so the moment these
-- policies land in production they become live. Unlike app tables (which have
-- RLS explicitly disabled until file 15 enables them), the storage policies
-- enforce immediately.
--
-- Consequence: applying this file BEFORE the auth gate is live in production
-- (i.e. while users still hit the app anonymously) will break ALL document
-- access, because auth.uid() is null for unauthenticated requests, and every
-- policy evaluates to false in that case.
--
-- Apply ORDER for production:
--   1. File 14 (Phase 5 backfill of owner_id) runs first.
--   2. Phase 2 (SSO + AuthGate) is deployed so users authenticate before
--      hitting the app.
--   3. Files 08-12 are applied.
--   4. This file (13) AND file 15 (RLS enable on app tables) AND the bucket
--      privacy flip happen together in the Phase 6 maintenance window.
--
-- The storage policies should be considered part of "the flip" alongside
-- file 15, not part of the dormant policy-write phase.

-- Drop the base-schema catch-all FIRST. supabase/documents.sql installed:
--   create policy "listing_documents_all" on storage.objects
--     for all using (bucket_id = 'listing-documents') with check (...);
-- That policy is permissive and unconditional (no auth.uid() check). Postgres
-- OR-combines permissive policies, so as long as it exists it nullifies every
-- policy below — any caller could read/insert/delete ANY listing document,
-- bypassing the anti-leaver super_admin-only DELETE. It MUST be dropped
-- atomically here, not as a manual runbook step.
drop policy if exists "listing_documents_all" on storage.objects;

-- Helper to extract listing_id from the storage path.
-- Path is `{listing_id}/{uuid}.{ext}` — the listing id is the FIRST segment.
create or replace function listing_id_from_storage_path(path text)
returns uuid
language sql
immutable
as $$
  select case
    when path ~ '^[0-9a-f-]{36}/'
    then (regexp_split_to_array(path, '/'))[1]::uuid
    else null
  end;
$$;

-- All three policies require the path to match the {uuid}/ convention.
-- Without the IS NOT NULL guard, a NULL listing_id from a malformed path would
-- short-circuit can_read_listing/can_edit_listing to TRUE for super_admin (because
-- is_super_admin() ignores the listing argument), letting an admin read or insert
-- files at any arbitrary path inside this bucket. Guard at the policy level
-- instead of the helper so the helper stays a pure path parser.

drop policy if exists "select_listing_documents" on storage.objects;
create policy "select_listing_documents" on storage.objects for select using (
  bucket_id = 'listing-documents'
  and listing_id_from_storage_path(name) is not null
  and can_read_listing(auth.uid(), listing_id_from_storage_path(name))
);

drop policy if exists "insert_listing_documents" on storage.objects;
create policy "insert_listing_documents" on storage.objects for insert with check (
  bucket_id = 'listing-documents'
  and listing_id_from_storage_path(name) is not null
  and can_edit_listing(auth.uid(), listing_id_from_storage_path(name))
);

drop policy if exists "delete_listing_documents" on storage.objects;
create policy "delete_listing_documents" on storage.objects for delete using (
  bucket_id = 'listing-documents'
  and listing_id_from_storage_path(name) is not null
  and is_super_admin(auth.uid())
);
