-- Stream B.2 Phase V1 — Vault listing <-> agent join table.
-- Source of truth: 2026-05-27-vault-integration-design.md (v2).
--
-- One row per (vault_listing_id, vault_staff_id) pair. Vault's `contactStaff[]`
-- is a true many-to-many: co-listings are real (V0 verified — sample listing
-- had 2 agents). Storing the agent set here keeps the secondary agent on a
-- co-listed property from being silently dropped (which the v1 single-column
-- design would have done).
--
-- `matched_user_id` is the per-row resolution of vault_staff_id -> profiles.user_id
-- (filled by the sync function in Phase V2). NULL when no profile maps to that
-- vault_staff_id; super_admin can override via vault_agent_aliases.
--
-- ON DELETE CASCADE on vault_listing_id: if a listing row is removed from the
-- cache, its agent rows go with it. (The sync function uses soft-delete via
-- status='withdrawn' rather than DELETE, so this cascade is a safety net, not
-- the primary lifecycle path.)
--
-- RLS intentionally disabled in V1; policies land in Phase V4.

CREATE TABLE IF NOT EXISTS vault_listing_agents (
  vault_listing_id    text NOT NULL REFERENCES vault_listings(vault_listing_id) ON DELETE CASCADE,
  vault_staff_id      text NOT NULL,             -- Vault's per-staff identifier from contactStaff[].id
  vault_staff_email   text,                      -- secondary signal for human disambiguation
  -- ON DELETE SET NULL matches the anti-leaver pattern in B.1: when a Blac
  -- user is deleted from auth.users, this row survives with the match
  -- severed (sync will surface it as unmatched on the next run, where a
  -- super_admin can reassign via vault_agent_aliases).
  matched_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_primary          boolean NOT NULL DEFAULT false,  -- Vault may distinguish lead agent; capture if present
  PRIMARY KEY (vault_listing_id, vault_staff_id)
);

CREATE INDEX IF NOT EXISTS vault_listing_agents_staff_idx        ON vault_listing_agents (vault_staff_id);
CREATE INDEX IF NOT EXISTS vault_listing_agents_matched_user_idx ON vault_listing_agents (matched_user_id);

ALTER TABLE vault_listing_agents DISABLE ROW LEVEL SECURITY;
