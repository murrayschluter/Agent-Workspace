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
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vault_agent_aliases DISABLE ROW LEVEL SECURITY;
