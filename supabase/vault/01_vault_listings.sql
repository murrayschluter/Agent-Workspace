-- Stream B.2 Phase V1 — Vault cache table.
-- Source of truth: 2026-05-27-vault-integration-design.md (v2, post-V0 findings).
--
-- Holds a read-only mirror of active VaultRE listings (status in
-- 'current' | 'conditional' | 'unconditional'). Refreshed hourly by the sync
-- function landing in Phase V2.
--
-- Multi-agent listings (co-listings) are NOT modelled here. The (listing, agent)
-- many-to-many lives in vault_listing_agents (02_vault_listing_agents.sql).
-- This was the key data-model change between spec v1 and v2.
--
-- RLS is intentionally left disabled in V1; policies land in Phase V4 alongside
-- Stream B.1 Phase 6 (coordinated RLS flip).

CREATE TABLE IF NOT EXISTS vault_listings (
  vault_listing_id    text PRIMARY KEY,
  address             text NOT NULL,
  suburb              text,
  state               text,
  postcode            text,
  list_date           date,
  status              text NOT NULL,             -- 'current' | 'conditional' | 'unconditional' (Vault's enum; sync filters to these three)
  campaign_type       text,                      -- maps to our existing campaign_type enum
  list_price_display  text,                      -- public price string (e.g. "Offers over $850k")
  vault_url           text,                      -- deep-link back to Vault UI
  last_synced_at      timestamptz NOT NULL DEFAULT now(),
  raw_payload         jsonb                      -- Vault's full response for future fields (decision 2026-05-28: readable by any authenticated @blacpg user, same as the rest of the row — see 14b_vault_rls.sql)
);

CREATE INDEX IF NOT EXISTS vault_listings_status_idx ON vault_listings (status);

ALTER TABLE vault_listings DISABLE ROW LEVEL SECURITY;
