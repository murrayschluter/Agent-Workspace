-- supabase/auth/17_set_listing_owner_on_insert.sql
-- Fix: new listings were created with NULL owner_id / created_by.
--
-- Surfaced during the post-Phase-6 staging smoke test. Creating a listing via
-- the app produced a row with owner_id = NULL, created_by = NULL. It only
-- "worked" because the creator was a super_admin: the insert_listings WITH
-- CHECK is
--   (auth.uid() IS NOT NULL) AND (owner_id = auth.uid() OR is_super_admin(...))
-- so super_admin passes via the second branch even with owner_id NULL. A
-- regular agent would be BLOCKED — owner_id NULL fails `owner_id = auth.uid()`
-- and they're not super_admin. So agents literally could not create listings,
-- and super_admin-created listings were unowned (invisible to the owner-based
-- read policy, and a data-quality hole the Phase 5 backfill would have to
-- keep patching).
--
-- ROOT CAUSE
-- The client createListing() does a bare `.insert(input)` and the New Listing
-- modal never sets owner_id / created_by. The listings table has triggers for
-- UPDATE (set_updated_at, set_updated_by, prevent_owner_reassign) and an
-- AFTER INSERT/UPDATE stage-history trigger — but NO BEFORE INSERT trigger to
-- stamp the creator. set_updated_by only fires on UPDATE.
--
-- FIX
-- A BEFORE INSERT trigger that defaults owner_id and created_by to auth.uid()
-- when the caller didn't supply them. Same shape and SECURITY INVOKER posture
-- as set_created_by_stage_history (07_triggers.sql) — auth.uid() resolves in
-- the caller's request context, so INVOKER is correct (no elevated privilege
-- needed; the function only reads auth.uid() and writes NEW columns).
--
-- ORDERING NOTE (why this satisfies the RLS WITH CHECK):
-- PostgreSQL fires BEFORE ROW triggers BEFORE evaluating the RLS WITH CHECK
-- expression. The trigger runs first and sets NEW.owner_id = auth.uid(); the
-- WITH CHECK then sees owner_id = auth.uid() and passes on its FIRST branch —
-- so a regular agent can now create listings without the super_admin bypass.
-- (Verified empirically on staging: insert with owner_id omitted in an
-- authenticated context returns owner_id = the caller's uid and the row is
-- accepted.)
--
-- Explicit-value preservation: if the caller DID set owner_id (e.g. a
-- super_admin creating a listing on behalf of another agent, or a service-role
-- import), we keep it. Only NULL is defaulted. created_by is always the actual
-- creator and is never overwritten if already set.

create or replace function set_listing_owner_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Default owner to the creator when not explicitly provided. A super_admin
  -- assigning a listing to someone else (or a service-role import that sets
  -- owner_id deliberately) keeps the supplied value.
  if new.owner_id is null then
    new.owner_id = auth.uid();
  end if;

  -- created_by is always the actual creator; never overwrite an explicit value
  -- (e.g. a backfill/import that knows the real creator).
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists listings_set_owner_on_insert on listings;
create trigger listings_set_owner_on_insert
  before insert on listings
  for each row
  execute function set_listing_owner_on_insert();
