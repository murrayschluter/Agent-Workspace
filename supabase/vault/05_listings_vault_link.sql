-- Stream B.2 Phase V1 — link app's listings table back to the Vault cache.
-- Source of truth: 2026-05-27-vault-integration-design.md (v2).
--
-- A tracked listing in our app may originate from a Vault listing. This adds
-- the optional pointer plus an index for the "find tracked listing by Vault
-- ID" lookup the UI does in the "Pick from my Vault listings" picker
-- (Phase V5).
--
-- NULL = listing was created blank in our app (no Vault counterpart).
-- The FK has no ON DELETE clause per spec — the sync function uses soft-delete
-- (status='withdrawn') on vault_listings rather than DELETE, so dangling
-- references are not the expected lifecycle. If a Vault row ever IS deleted,
-- the FK will block it until the dependent listings row is updated.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- (The listings table's RLS state is owned by Stream B.1 — not touched here.)

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS vault_listing_id text REFERENCES vault_listings(vault_listing_id);

CREATE INDEX IF NOT EXISTS listings_vault_id_idx ON listings (vault_listing_id);
