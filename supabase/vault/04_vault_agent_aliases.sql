-- Stream B.2 Phase V1 — super_admin override for unmatched Vault staff.
-- Source of truth: 2026-05-27-vault-integration-design.md (v2).
--
-- Manual mapping from Vault's per-staff identifier (contactStaff[].id) to a
-- Blac user. Used by the sync function as a fallback when
-- profiles.vault_user_id does not resolve.
--
-- Key choice: keyed on `vault_staff_id` (not email, not a separate agent_id).
-- The v2 spec matches on contactStaff[].id (the same field
-- vault_listing_agents.vault_staff_id stores), so the alias table must use the
-- same identifier to be useful as a fallback lookup. Renamed from the v1 spec's
-- `vault_agent_id` for naming consistency across the Vault schema.
--
-- RLS intentionally disabled in V1; super_admin-only policies land in Phase V4.

CREATE TABLE IF NOT EXISTS vault_agent_aliases (
  vault_staff_id  text PRIMARY KEY,                       -- Vault's contactStaff[].id (same column meaning as vault_listing_agents.vault_staff_id)
  -- ON DELETE CASCADE: an alias whose target user is gone has no meaning.
  -- The alias row disappears when the user is deleted from auth.users.
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ON DELETE SET NULL on created_by: audit field, preserve the alias row
  -- when the super_admin who created it leaves Blac. Matches the anti-leaver
  -- pattern from B.1 (e.g. listing_collaborators.invited_by).
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vault_agent_aliases DISABLE ROW LEVEL SECURITY;
