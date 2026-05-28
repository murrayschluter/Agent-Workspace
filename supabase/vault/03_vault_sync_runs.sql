-- Stream B.2 Phase V1 — Vault sync attempt log.
-- Source of truth: 2026-05-27-vault-integration-design.md (v2).
--
-- One row per sync attempt (cron tick or manual refresh). The sync function
-- (Phase V2) inserts a row with status='running' at start, updates it at end
-- with the counts and final status. Powers the admin "Sync history" panel and
-- the "last synced" indicator.
--
-- RLS intentionally disabled in V1; super_admin-only policies land in Phase V4.

CREATE TABLE IF NOT EXISTS vault_sync_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  listings_pulled   int,
  listings_created  int,
  listings_updated  int,
  listings_removed  int,
  status            text NOT NULL,              -- 'running' | 'success' | 'partial' | 'failure'
  error_message     text
);

CREATE INDEX IF NOT EXISTS vault_sync_runs_finished_idx ON vault_sync_runs (finished_at DESC);

ALTER TABLE vault_sync_runs DISABLE ROW LEVEL SECURITY;
