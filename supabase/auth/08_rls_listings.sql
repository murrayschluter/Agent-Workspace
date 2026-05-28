-- supabase/auth/08_rls_listings.sql
-- Policies on listings. RLS not enabled here; that's file 15.

-- SELECT: super_admin sees all, owner sees own, collaborators see invited.
drop policy if exists "select_listings" on listings;
create policy "select_listings" on listings
  for select using (
    is_super_admin(auth.uid())
    or owner_id = auth.uid()
    or exists (
      select 1 from listing_collaborators
      where listing_collaborators.listing_id = listings.id
        and listing_collaborators.user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create a listing they own; super_admin
-- can create on behalf of another agent (owner_id explicit).
drop policy if exists "insert_listings" on listings;
create policy "insert_listings" on listings
  for insert with check (
    auth.uid() is not null
    and (owner_id = auth.uid() or is_super_admin(auth.uid()))
  );

-- UPDATE: super_admin, owner, or editor+ collaborator.
drop policy if exists "update_listings" on listings;
create policy "update_listings" on listings
  for update using (
    can_edit_listing(auth.uid(), id)
  );

-- DELETE: super_admin ONLY. Owners cannot delete (they archive via stage transition).
drop policy if exists "delete_listings" on listings;
create policy "delete_listings" on listings
  for delete using (
    is_super_admin(auth.uid())
  );
