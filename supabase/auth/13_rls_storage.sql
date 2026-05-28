-- supabase/auth/13_rls_storage.sql
-- Storage policies for the listing-documents bucket.
-- File path convention: listings/{listing_id}/{filename}

-- Helper to extract listing_id from the storage path.
create or replace function listing_id_from_storage_path(path text)
returns uuid
language sql
immutable
as $$
  select case
    when path ~ '^listings/[0-9a-f-]{36}/'
    then (regexp_split_to_array(path, '/'))[2]::uuid
    else null
  end;
$$;

drop policy if exists "select_listing_documents" on storage.objects;
create policy "select_listing_documents" on storage.objects for select using (
  bucket_id = 'listing-documents'
  and can_read_listing(auth.uid(), listing_id_from_storage_path(name))
);

drop policy if exists "insert_listing_documents" on storage.objects;
create policy "insert_listing_documents" on storage.objects for insert with check (
  bucket_id = 'listing-documents'
  and can_edit_listing(auth.uid(), listing_id_from_storage_path(name))
);

drop policy if exists "delete_listing_documents" on storage.objects;
create policy "delete_listing_documents" on storage.objects for delete using (
  bucket_id = 'listing-documents'
  and is_super_admin(auth.uid())
);
