# PROJECT_SYNC.md — Coordination source of truth

> Read this and `TASKS.md` before starting work. GitHub is the source of truth. Last reconciled: **2026-07-16** by bpg-ant.

## Current goal

Ship the Listing Portal as a reliable, phone-friendly production workspace for Blac Property Group. The production database migration is complete. Current work is application hardening, mobile usability and launch operations.

## Production state

- Repository: `murrayschluter/Agent-Workspace`.
- Production Supabase: `jdsbqfccdgipnlvcpgva` (Murray Work Dash).
- Production RLS flip completed 2026-06-02 after a logical data backup.
- All 15 protected tables have RLS enabled. Murray's 9 legacy listings were assigned to his super-admin profile.
- Storage bucket `listing-documents` is private and document access uses signed URLs.
- Microsoft SSO and role-aware access are implemented.
- Vercel remains on Hobby. The hourly Vault cron remains disabled until Pro or an alternative scheduler is selected.
- The latest merged application work on `main` is PR #36 (`84b4d29`), the Add-from-Vault picker.

## Security and audit state

The pre-migration audit in issue #29 is complete. Its blocker/high findings shipped in PRs #30–#35:

- storage catch-all policies removed and path matching corrected
- private document access moved to signed URLs
- child deletion, standalone task and collaborator-RPC gaps corrected
- last-super-admin demotion race protected by an advisory lock
- touchpoint generation and sending require a valid user session
- touchpoint recipients are derived server-side

Staging verification covered all nine audit dimensions and passed 66 checks. Issue #29 should remain as the historical audit record but does not represent open engineering work.

## CI state

- Main-branch protection verification exists and passes on pull requests.
- Production-RLS verification is configured but currently fails because the `SUPABASE_ACCESS_TOKEN` stored in GitHub does not have permission to call the production database-query Management API. This is a credential-privilege problem, not evidence that RLS is disabled.
- Draft PR #38 adds application lint, tests and production-build verification.

## Active pull requests

| PR | Branch | Scope | Status |
|---|---|---|---|
| #37 | `feat/ant-mobile-production-hardening` | Responsive iPhone navigation and Vault controls | Draft, ready for Murray review |
| #38 | `chore/ant-ci-baseline` | ESLint, Vitest and application CI | Draft, ready for Murray review |
| #39 | `fix/ant-auth-state` | One auth subscription and retryable profile errors | Draft, ready for Murray review |
| #40 | `feat/ant-vault-sync-status` | Vault freshness and failure indicator | Draft, ready for Murray review |
| #42 | `chore/ant-route-code-splitting` | Lazy route loading and smaller initial bundle | Draft, ready for Murray review |

PR #27 contains stale, conflicting coordination changes from before the production flip and should be closed as superseded.

## Required launch operations

1. Replace `SUPABASE_ACCESS_TOKEN` in GitHub with a token belonging to an account that can query project `jdsbqfccdgipnlvcpgva`, then rerun Verify production RLS.
2. Review and merge PRs #37–#40 and #42. Start with #38. PRs #39, #37 and #42 touch `App.jsx`, and PRs #37/#40 touch `VaultPicker.jsx`, so rebase each successive PR onto the updated `main` before merging it.
3. Confirm the Vercel production deployment points to the production Supabase URL and publishable key and has all server-only secrets.
4. Decide whether to upgrade Vercel to Pro. If yes, restore the hourly cron from `docs/vault-sync-scheduling.md`.
5. Add recurring full backups or Supabase managed backups/PITR for production client data.

## Working agreements

- Follow `AGENTS.md`; never change `main` directly.
- Branches use `<type>/<owner>-<slug>` and each branch has one scope.
- `ant/*` code requires Murray review. `murray/*` code requires bpg-ant review.
- Never run repository SQL against production from an agent session.
- Secrets belong in GitHub, Vercel or Supabase settings, never in tracked files.
- Update this file and `TASKS.md` when the actual project state changes.
