-- supabase/auth/15_enable_rls.sql
-- Phase 6: the RLS flip.
--
-- This is the load-bearing transition where the database moves from
-- "open by default" to "denied by default, allowed by explicit policy".
-- Before this file runs, the 11 auth-RBAC tables and 4 vault cache tables
-- all have RLS DISABLED — every authenticated request reads everything.
-- After this file runs, every read and write is gated by the policies
-- written in files 06-14b.
--
-- Hard preconditions (each MUST be true before applying to ANY environment):
--
--   1. All policy files (06-14b) have been applied and verified:
--      - 06_helpers.sql (is_super_admin, can_read_listing, can_edit_listing,
--        listing_id_from_storage_path)
--      - 07_triggers.sql (prevent_owner_reassign, prevent_self_role_change,
--        prevent_last_super_admin_demotion, provision_profile,
--        record_stage_history, set_created_by_stage_history, set_updated_at,
--        set_updated_by)
--      - 08_rls_listings.sql (listings: select / insert / update / delete)
--      - 09_rls_children.sql (weekly_logs, contracts, touchpoints,
--        stage_history, documents, custom_tasks, listing_services)
--      - 10_rls_collaborators.sql (listing_collaborators)
--      - 11_rls_profiles.sql (profiles)
--      - 12_rls_admin_log.sql + 12a_admin_log_tighten.sql (admin_access_log)
--      - 13_rls_storage.sql (storage.objects — already live, RLS-on by default)
--      - 14a_invite_picker_rpc.sql (list_invitable_profiles)
--      - 14b_vault_rls.sql (vault_listings, vault_listing_agents,
--        vault_agent_aliases, vault_sync_runs SELECT policies)
--      - 14c_admin_action_rpcs.sql (change_user_role, deactivate_user)
--
--   2. Phase 5 backfill of `owner_id` on listings has completed — every
--      listing row has a non-null owner_id pointing at a real profile.
--      Verify via: SELECT COUNT(*) FROM listings WHERE owner_id IS NULL.
--      Expected: 0.
--
--   3. Phase 2 (SSO + AuthGate) is deployed and active. Every request
--      hitting the app has a non-null auth.uid(). Without this, RLS
--      policies that rely on auth.uid() evaluate to NULL and all reads
--      return empty — breaking the app for everyone.
--
--   4. A super_admin profile exists. Verify via:
--        SELECT COUNT(*) FROM profiles WHERE role = 'super_admin'.
--      Expected: >= 1. If this is zero, you will be locked out of every
--      table that requires super_admin to administer.
--
--   5. The application's read paths use the new RPCs where required —
--      ShareDialog uses list_invitable_profiles, UserManagement uses
--      change_user_role / deactivate_user. PRs #15 (RPC), #13 (ShareDialog
--      migration), #14 (admin RPCs) MUST be merged before flipping.
--
-- Apply procedure (production):
--
--   1. Take a database snapshot via Supabase Dashboard → Backups → Create.
--   2. Verify all five preconditions above by running the verification
--      queries in a SELECT-only session.
--   3. Apply this file in a single transaction (the file is wrapped in
--      BEGIN/COMMIT below — do NOT split into separate statements).
--   4. Immediately run the verification block at the bottom of this file.
--      Every row should show rls_enabled = true.
--   5. Smoke-test the application: sign in as super_admin, then sign in
--      as a non-admin agent, verify the visibility boundaries hold.
--   6. If anything looks wrong, immediately roll back with the matching
--      DISABLE statements (commented out below — uncomment for rollback).
--
-- Rollback (production):
--
--   The DISABLE statements at the very bottom of this file are commented
--   out. To roll back, copy them into a new SQL session, uncomment, and
--   apply. The policies themselves are not dropped — RLS just goes back
--   to "disabled, all access open" while you investigate.
--
-- This file is intentionally a SINGLE TRANSACTION. Either every table
-- gets RLS or none do — there is no "half on, half off" intermediate
-- state where part of the app works and part doesn't.

BEGIN;

-- 11 auth-RBAC tables
ALTER TABLE listings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE touchpoints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_log      ENABLE ROW LEVEL SECURITY;

-- 4 vault cache tables. SELECT policies from 14b_vault_rls.sql become
-- effective at this point; writes from anything other than service_role
-- are denied.
ALTER TABLE vault_listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_listing_agents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_agent_aliases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_sync_runs       ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Post-apply verification: every row must show rls_enabled = true.
-- Run this immediately after the transaction commits.
--
-- SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND c.relname IN (
--     'listings', 'weekly_logs', 'contracts', 'touchpoints', 'stage_history',
--     'documents', 'custom_tasks', 'listing_services', 'profiles',
--     'listing_collaborators', 'admin_access_log',
--     'vault_listings', 'vault_listing_agents', 'vault_agent_aliases',
--     'vault_sync_runs'
--   )
-- ORDER BY c.relname;

-- ROLLBACK (do not uncomment unless rolling back):
--
-- BEGIN;
-- ALTER TABLE listings              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE weekly_logs           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE contracts             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE touchpoints           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE stage_history         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE custom_tasks          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE listing_services      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE profiles              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE listing_collaborators DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_access_log      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vault_listings        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vault_listing_agents  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vault_agent_aliases   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vault_sync_runs       DISABLE ROW LEVEL SECURITY;
-- COMMIT;
