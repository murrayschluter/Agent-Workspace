-- supabase/auth/14b_vault_rls.sql
-- Phase 6 prerequisite: RLS policies for the four vault_* cache tables.
--
-- Per spec discussion 2026-05-28: vault tables are a read-only cache of
-- VaultRE's active-listing dataset, populated by `api/sync-vault-listings.js`
-- running as service_role. Access model:
--
--   - authenticated: SELECT (any signed-in @blacpg.com.au user can see
--     cached listings — needed for the co-listing picker in ShareDialog
--     and for read-only listing detail views that reference vault data)
--   - service_role: full access (the sync function inserts/updates/upserts
--     rows; service_role bypasses RLS by default via BYPASSRLS, so no
--     explicit policies are needed for writes)
--   - anon: no access (RLS denies by default; no policy = no read)
--
-- File numbering note (per the same convention as 14a_invite_picker_rpc.sql):
-- file 14 is reserved for the Phase 5 owner_id backfill, file 15 is the
-- RLS enable flip. These vault policies need to land BEFORE file 15 so
-- they're in place when RLS turns on. Slot in as `14b_` — independent of
-- `14a_` (no functional dependency), both just sort before file 15.
--
-- Phase 6 dependency NOT yet resolved: `15_enable_rls.sql` currently
-- targets only the 11 auth-RBAC tables. When that file is written, it
-- MUST also enable RLS on these four vault tables — otherwise the
-- policies below are dormant. Tracked in a follow-up; flagging here so
-- it's not missed.
--
-- PR #17's `verify-prod-rls.yml` workflow ALSO needs updating — the
-- table-name allowlist currently lists 11 auth-RBAC tables. After this
-- ships, the workflow should include the vault tables in the assertion.
-- Will be done in a follow-up PR alongside file 15.

-- vault_listings — main cache table
drop policy if exists "select_vault_listings" on vault_listings;
create policy "select_vault_listings" on vault_listings for select
  to authenticated
  using (true);

-- vault_listing_agents — many-to-many join (listing ↔ agent)
drop policy if exists "select_vault_listing_agents" on vault_listing_agents;
create policy "select_vault_listing_agents" on vault_listing_agents for select
  to authenticated
  using (true);

-- vault_agent_aliases — display-name lookup table
drop policy if exists "select_vault_agent_aliases" on vault_agent_aliases;
create policy "select_vault_agent_aliases" on vault_agent_aliases for select
  to authenticated
  using (true);

-- vault_sync_runs — history of sync runs; useful for ops/admin UI
drop policy if exists "select_vault_sync_runs" on vault_sync_runs;
create policy "select_vault_sync_runs" on vault_sync_runs for select
  to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies. RLS (once enabled) will deny
-- writes from authenticated callers. service_role bypasses RLS and
-- handles all writes via `api/sync-vault-listings.js`.
--
-- If a future requirement needs UI-level write access (e.g. an admin
-- manually overriding a stale cache row), add a super_admin-scoped
-- policy in a follow-up file rather than broadening this one.
