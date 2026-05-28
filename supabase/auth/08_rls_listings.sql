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
-- NOTE on WITH CHECK: Postgres reuses USING for the new-row check when no
-- WITH CHECK is given. That's safe for most columns but NOT for owner_id —
-- without a separate guard, an editor collaborator could set owner_id to
-- themselves and still pass can_edit_listing() on the new row (because they
-- are now the owner). The prevent_owner_reassign trigger below blocks that.
drop policy if exists "update_listings" on listings;
create policy "update_listings" on listings
  for update using (
    can_edit_listing(auth.uid(), id)
  );

-- prevent_owner_reassign: only super_admin may change owner_id.
-- WITH CHECK can't easily reference OLD.owner_id, so this is a BEFORE UPDATE
-- trigger. Same pattern as prevent_self_role_change on the profiles table.
-- The trigger is SECURITY INVOKER (default); search_path pinned for the
-- function_search_path_mutable linter.
create or replace function prevent_owner_reassign()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not is_super_admin(auth.uid()) and new.owner_id is distinct from old.owner_id then
    raise exception 'Only super_admin can reassign listing ownership. Tried to change owner_id from % to %.', old.owner_id, new.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_prevent_owner_reassign on listings;
create trigger listings_prevent_owner_reassign
  before update on listings
  for each row execute function prevent_owner_reassign();

-- DELETE: super_admin ONLY. Owners cannot delete (they archive via stage transition).
drop policy if exists "delete_listings" on listings;
create policy "delete_listings" on listings
  for delete using (
    is_super_admin(auth.uid())
  );
