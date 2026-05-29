-- supabase/auth/16_fix_policy_recursion.sql
-- Fix: infinite recursion between listings and listing_collaborators RLS.
--
-- Surfaced the moment Phase 6 (file 15) enabled RLS on staging. Loading the
-- dashboard failed with:
--   "infinite recursion detected in policy for relation \"listings\""
--
-- ROOT CAUSE
-- ----------
-- The original policies referenced each other's tables with INLINE subqueries:
--
--   select_listings              USING (... EXISTS (SELECT 1 FROM listing_collaborators ...))
--   select_listing_collaborators USING (... EXISTS (SELECT 1 FROM listings ...))
--
-- With RLS off (pre-Phase-6) the inline subqueries read freely, so this was
-- dormant. With RLS on, each subquery read triggers the OTHER table's SELECT
-- policy, which triggers the first table's SELECT policy, and so on — Postgres
-- detects the cycle and aborts the query.
--
-- This is exactly the fragility flagged in the auth-rbac design doc v4:
-- "recursive RLS between listings and listing_collaborators works by policy
-- coincidence rather than design (consider refactoring inline EXISTS in
-- select_listings to call can_read_listing SECURITY DEFINER for robustness)."
--
-- FIX
-- ---
-- Route every cross-table (and self-table) ownership/membership check through
-- a SECURITY DEFINER helper. A SECURITY DEFINER function runs as the function
-- owner (the table owner), which bypasses RLS on the tables it reads — so the
-- read inside the helper does NOT re-trigger any policy. The cycle is broken
-- by construction, not by coincidence.
--
-- Two new helpers (same shape as the existing 06_helpers.sql functions:
-- STABLE + SECURITY DEFINER + pinned search_path):
--   is_listing_owner(user, listing)    — owner_id = user
--   is_listing_co_owner(user, listing) — has a co_owner collaborator row
--
-- These are narrower than the existing can_read_listing / can_edit_listing:
--   - can_read_listing  = super_admin OR owner OR ANY collaborator
--   - can_edit_listing  = super_admin OR owner OR editor/co_owner collaborator
--   - is_listing_owner  = owner ONLY (no super_admin shortcut — callers add
--                         is_super_admin(...) explicitly where wanted, matching
--                         the original policy text exactly)
--   - is_listing_co_owner = co_owner collaborator ONLY
--
-- Collaborator MANAGEMENT (insert/update/delete on listing_collaborators) is
-- deliberately owner + super_admin (+ co_owner for insert) — NOT editors. So we
-- cannot reuse can_edit_listing here; that would let editors manage sharing.
-- The dedicated owner/co_owner helpers preserve the original semantics exactly.
--
-- Policies rewritten (semantics unchanged — verified line-by-line against the
-- pre-fix definitions):
--   listings.select_listings
--   listing_collaborators.select_listing_collaborators
--   listing_collaborators.insert_listing_collaborators
--   listing_collaborators.update_listing_collaborators
--   listing_collaborators.delete_listing_collaborators
--
-- Applied to staging via Management API and verified: dashboard loads, all 15
-- tables still RLS-enabled, policy quals now reference only SECURITY DEFINER
-- helpers (zero inline cross-table subqueries remain — confirmed by scanning
-- pg_policies).

begin;

-- ---------------------------------------------------------------------------
-- New SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------

create or replace function is_listing_owner(check_user_id uuid, check_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from listings
    where id = check_listing_id and owner_id = check_user_id
  );
$$;

create or replace function is_listing_co_owner(check_user_id uuid, check_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from listing_collaborators
    where listing_id = check_listing_id
      and user_id = check_user_id
      and level = 'co_owner'
  );
$$;

-- Grant the same way the rest of the helpers are exposed: callable by any
-- signed-in user (the policies that use them run in the caller's context).
-- These take a uuid parameter and read nothing sensitive beyond ownership
-- booleans, so they follow the same grant posture as is_super_admin /
-- can_read_listing (which Postgres/Supabase default to PUBLIC+anon EXECUTE).
-- They short-circuit harmlessly when check_user_id is null (no row matches),
-- so anon EXECUTE is benign — same reasoning as the 06_helpers.sql functions.

-- ---------------------------------------------------------------------------
-- listings: SELECT — was inline EXISTS into listing_collaborators (the cycle)
-- ---------------------------------------------------------------------------

drop policy if exists "select_listings" on listings;
create policy "select_listings" on listings
  for select using (
    can_read_listing(auth.uid(), id)
  );

-- ---------------------------------------------------------------------------
-- listing_collaborators: SELECT — was inline EXISTS into listings (the cycle)
-- ---------------------------------------------------------------------------

drop policy if exists "select_listing_collaborators" on listing_collaborators;
create policy "select_listing_collaborators" on listing_collaborators
  for select using (
    can_read_listing(auth.uid(), listing_id)
  );

-- ---------------------------------------------------------------------------
-- listing_collaborators: write policies — were inline EXISTS into listings
-- (and a self-reference for the co_owner case). Not the active cycle, but the
-- same fragility class. Route through the new owner/co_owner helpers.
-- ---------------------------------------------------------------------------

-- INSERT: super_admin OR listing owner OR an existing co_owner collaborator.
drop policy if exists "insert_listing_collaborators" on listing_collaborators;
create policy "insert_listing_collaborators" on listing_collaborators
  for insert with check (
    is_super_admin(auth.uid())
    or is_listing_owner(auth.uid(), listing_id)
    or is_listing_co_owner(auth.uid(), listing_id)
  );

-- UPDATE: super_admin OR listing owner. (Co_owners can add via INSERT but not
-- re-level existing rows — original semantics preserved.)
drop policy if exists "update_listing_collaborators" on listing_collaborators;
create policy "update_listing_collaborators" on listing_collaborators
  for update using (
    is_super_admin(auth.uid())
    or is_listing_owner(auth.uid(), listing_id)
  );

-- DELETE: super_admin OR listing owner OR the collaborator removing themselves.
drop policy if exists "delete_listing_collaborators" on listing_collaborators;
create policy "delete_listing_collaborators" on listing_collaborators
  for delete using (
    is_super_admin(auth.uid())
    or user_id = auth.uid()
    or is_listing_owner(auth.uid(), listing_id)
  );

commit;

-- Post-apply verification (run after commit):
--
-- 1. No inline cross-table subqueries remain on these two tables:
--    SELECT tablename, policyname, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('listings', 'listing_collaborators')
--    ORDER BY tablename, policyname;
--    -- Every qual/with_check should reference only helper functions
--    -- (is_super_admin / can_read_listing / can_edit_listing /
--    -- is_listing_owner / is_listing_co_owner) or simple column checks
--    -- (owner_id = auth.uid(), user_id = auth.uid()). No "FROM listings"
--    -- or "FROM listing_collaborators" subqueries.
--
-- 2. The two new helpers are SECURITY DEFINER:
--    SELECT proname, prosecdef FROM pg_proc
--    WHERE proname IN ('is_listing_owner', 'is_listing_co_owner');
--    -- prosecdef must be true for both.
