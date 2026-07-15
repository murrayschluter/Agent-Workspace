# TASKS.md — Working board

> Pair with `PROJECT_SYNC.md`. Last reconciled: **2026-07-16** by bpg-ant.

## Needs human or account-owner action

- **[Murray] Review PR #37:** responsive iPhone navigation.
- **[Murray] Review PR #38:** application lint, tests and build CI.
- **[Murray] Review PR #39:** central authentication state and recovery.
- **[Murray] Review PR #40:** Vault sync freshness indicator.
- **[Repo admin] Repair the production-RLS CI credential:** replace the current Supabase PAT with one that has Management API database-query access to `jdsbqfccdgipnlvcpgva`, then rerun the failed workflow.
- **[Human decision] Vercel Pro:** upgrade and enable hourly Vault cron, or choose another scheduler.
- **[Human decision] Production backups:** Supabase Pro/PITR or a recurring full `pg_dump` process.

## In progress

- **[BA] Project-state reconciliation:** replace stale migration-era records and retire conflicting PR #27.

## Ready next

- Confirm production Vercel environment variables and target project without exposing their values.
- Add browser-level tests for SSO routing, role gates, task completion and Vault import after PR #38 merges.
- Split `api/sync-vault-listings.js` into API client, mapping, persistence and handler modules.
- Add error monitoring and sync-failure alerting.
- Add a protected manual Vault sync action for administrators, without exposing `CRON_SECRET` to the browser.
- Add route-level code splitting to reduce the current JavaScript bundle warning.

## Done

- Production database migration and RLS flip completed 2026-06-02.
- Production storage bucket made private; signed document URLs shipped.
- Pre-migration security audit blockers and highs shipped in PRs #30–#35.
- Add-from-Vault picker shipped in PR #36.
- Mobile implementation published as draft PR #37.
- Application CI implementation published as draft PR #38.
- Auth-state implementation published as draft PR #39.
- Vault sync-status implementation published as draft PR #40.
