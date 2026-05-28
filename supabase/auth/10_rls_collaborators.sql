-- supabase/auth/10_rls_collaborators.sql

drop policy if exists "select_listing_collaborators" on listing_collaborators;
create policy "select_listing_collaborators" on listing_collaborators for select using (
  is_super_admin(auth.uid())
  or user_id = auth.uid()
  or exists (
    select 1 from listings
    where id = listing_collaborators.listing_id and owner_id = auth.uid()
  )
);

-- INSERT: super_admin, owner of the listing, or co_owner collaborator can invite.
drop policy if exists "insert_listing_collaborators" on listing_collaborators;
create policy "insert_listing_collaborators" on listing_collaborators for insert with check (
  is_super_admin(auth.uid())
  or exists (
    select 1 from listings
    where id = listing_collaborators.listing_id and owner_id = auth.uid()
  )
  or exists (
    select 1 from listing_collaborators lc
    where lc.listing_id = listing_collaborators.listing_id
      and lc.user_id = auth.uid()
      and lc.level = 'co_owner'
  )
);

-- UPDATE: same as INSERT (e.g., changing a collaborator's level).
drop policy if exists "update_listing_collaborators" on listing_collaborators;
create policy "update_listing_collaborators" on listing_collaborators for update using (
  is_super_admin(auth.uid())
  or exists (
    select 1 from listings
    where id = listing_collaborators.listing_id and owner_id = auth.uid()
  )
);

-- DELETE: super_admin, owner, or yourself (you can revoke your own access).
drop policy if exists "delete_listing_collaborators" on listing_collaborators;
create policy "delete_listing_collaborators" on listing_collaborators for delete using (
  is_super_admin(auth.uid())
  or user_id = auth.uid()
  or exists (
    select 1 from listings
    where id = listing_collaborators.listing_id and owner_id = auth.uid()
  )
);
