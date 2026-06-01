# PROJECT_SYNC.md — Coordination source of truth

> **Read this first, every session.** This file + `TASKS.md` are how the two Claude agents coordinate. GitHub is the source of truth — not chat, not email. Last updated: **2026-06-01** by Murray's Claude (Lead Integrator).

---

## Current project goal

**Listing Portal** — a single-team real-estate listing lifecycle tracker for Blac Property Group (React 19 + Vite + Supabase + Anthropic Claude + ClickSend SMS).

Active objective right now: **ship auth/RBAC + the Vault read-integration to production.** All the code is built and merged; the remaining work is a one-time production database migration (Phase 3–6) plus launch-time infra upgrades.

## Who is working on what

| Agent | GitHub login | Human | Branch prefix | Role |
|---|---|---|---|---|
| Murray's Claude (a.k.a. "claude-a") | `murrayschluter` | Murray (repo admin) | `*/murray-*` | **Lead Integrator** — keeps repo coherent, maintains these files, reviews `ant/*`, merges safe changes |
| Riyad's Claude (a.k.a. "claude-b") | `bpg-ant` | Riyad / Antony (collaborator) | `*/ant-*` | Builds features, drives the prod migration, reviews `murray/*` |

The fuller design specs + prod runbook live in a **separate private repo on the bpg-ant side** (`bpg-ant/agent-workspace-specs`). This repo (`murrayschluter/Agent-Workspace`) is the code + coordination source of truth.

## Current known state

- **Code phase is COMPLETE.** Every PR #2–#26 is merged. No open PRs. `main` == what's running/validated on staging Supabase.
- The app is deployed on **Vercel (Hobby plan)**; production URL `agent-workspace-blacpg-s-projects.vercel.app` (behind Vercel Deployment Protection → 401 to logged-out visitors).
- **Prod Supabase project = `jdsbqfccdgipnlvcpgva`** ("Murray Work Dash"). It holds **real data** (9 listings, 16 touchpoints, 6 contracts, 4 weekly logs, 9 stage-history rows). Base schema only — **none of the auth/RBAC migration chain is applied to prod yet**; `auth.users` is empty.
- **Microsoft SSO (Azure) is enabled + verified on prod** (authorize endpoint 302s to Microsoft correctly). Redirect allowlist has `http://localhost:5173` + the prod URL.
- The **prod data migration is mid-flight** — see "Next best actions". Currently waiting on a `pg_dump` backup (Supabase Free tier has no managed snapshots).

## What has already been completed

- **Governance scaffolding** (#2, #3): `AGENTS.md`, PR/issue templates, branch-protection ruleset on `main`, CI workflow that fails any PR if `main` protection is removed.
- **Stream B.1 — Auth/RBAC** (#4–#9, #12–#15, #18, #19, #22, #24, #25): enums/profiles/collaborators/audit-log schema, ownership columns, helper functions, triggers, Microsoft SSO + role-aware AuthGate, awaiting-access screen, ProfileMenu, admin override mechanics, sharing UI, AuditLog + UserManagement pages, the invite-picker RPC, all RLS policies, and the **Phase 6 RLS-flip file** (`15_enable_rls.sql`). Post-flip hotfixes: RLS recursion (#22), owner_id-on-insert (#24 → `17_*`), created_by stamping (#25 → `18_*`), input contrast (#23). **`supabase/auth/` = 23 files (01–18, incl. 05a/12a/14a/14b/14c).**
- **Stream B.2 — Vault read integration** (#10, #11, #16, #18): vault cache schema (`supabase/vault/` 01–05), the read-only sync function (`api/sync-vault-listings.js`, secret-safe, CRON_SECRET-gated), Vercel cron config (cron removed from `vercel.json` on Hobby — see Decisions), and vault RLS policies.
- **Phase 5 backfill** (#21): `14_backfill_owner_id.sql` — assigns NULL-owner legacy listings to the sole super_admin, with the `prevent_owner_reassign` trigger disabled/re-enabled around the UPDATE.
- **Prod SSO config** enabled + verified; **prod runbook** authored + corrected (issue #20).
- **Coordination + docs** (#26 + `chore/murray-docs-refresh`): PROJECT_SYNC.md/TASKS.md added; README refreshed to current reality; vault-sync doc contradiction fixed.

## What is broken or uncertain

- **Nothing is broken in code.** `main` is green (all CI passing) and == staging.
- **Uncertain / pending verification:** the prod migration hasn't run, so the RLS policies are unproven against prod's real data shape (they passed on staging). Mitigation: the run-of-show on #20 has a verify gate after every step + a `pg_dump` rollback.
- **Runbook gaps caught + corrected on #20** (Lead Integrator coherence pass, 2026-06-01) — flagged here so the prod apply uses the corrected order:
  1. The `supabase/vault/` schema files were missing from the apply order → would have failed at `14b_vault_rls` (`relation "vault_listings" does not exist`). Now inserted before `14b`.
  2. `17_set_listing_owner_on_insert` (**CRITICAL** — without it a non-super-admin agent cannot create a listing after the flip) and `18_stamp_created_by_children` were missing from the apply order. Now appended after `16`.
- **Vercel env-var name mismatch** (deferred, harmless on Hobby): Vercel has `VAULT_API_KEY`/`VAULT_API_TOKEN` but the function reads `VAULTRE_API_KEY`/`VAULTRE_BEARER_TOKEN` (+ missing `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Fix at launch — see TASKS.md.

## Decisions made

1. **`main` protection = ruleset** (1 approval, linear history, no force-push/deletion). Classic protection removed (was redundant). Verified via `gh api`.
2. **Self-merge bypass actors added** (Repository admin + Write role, "for pull requests only") so each side can merge own PRs without waiting on the human — for **momentum when the other is away**. Force-push/deletion of `main` still blocked.
3. **Prod Supabase = `jdsbqfccdgipnlvcpgva`** is THE prod project (supersedes the earlier idea of bpg-ant standing up a separate one).
4. **Listing ownership: all 9 prod listings are Murray's.** No split. Phase 5 backfill runs unchanged (all orphans → Murray).
5. **Vercel stays on Hobby until launch**, then upgrade to Pro to enable the hourly Vault cron (cron removed from `vercel.json`; tracked in issue #20). *Assumption:* daily/manual sync is acceptable pre-launch. *Reason:* app isn't live; openclaw pipeline covers data pulls. *Risk:* low. *Change later:* re-add `crons[]` after Pro upgrade.
6. **Supabase prod is on Free tier → no managed backups.** Backup before the migration is a `pg_dump` (run by bpg-ant, who has DB access + tooling).
7. **Branch convention kept as `<type>/<owner>-<slug>`** (murray/ant), NOT switched to claude-a/claude-b. *Reason:* 24+ merged PRs, the protection ruleset, and the review-routing all depend on it. claude-a/claude-b labels map to murray/ant (see table above).
8. **Lead Integrator may self-merge SAFE coordination/governance/docs files** (PROJECT_SYNC.md, TASKS.md, README, docs) via the admin bypass once CI is green. *Code* changes still require cross-review (ant/* → Murray, murray/* → bpg-ant) — that cross-review has caught real bugs (#11, #6, #18, #22) and stays mandatory.

## Open questions for the human (Murray)

1. **When can the joint prod-migration session run?** It needs Murray (SSO sign-in + watching) + bpg-ant (driving SQL). Currently the only true blocker to going live.
2. **At launch:** upgrade Vercel → Pro (re-enable cron) and optionally Supabase → Pro (managed backups/PITR for client data)? Both are spend decisions.

*(Everything else is being decided by the agents and recorded here — per the reset, stop routing small choices through Murray.)*

## Next best actions

1. **bpg-ant:** run the `pg_dump` prod backup (requested on issue #20) → confirm saved → unblocks Phase B.
2. **Joint session (Murray + bpg-ant):** execute the corrected prod runbook on issue #20 — backup → schema+policies RLS-off (incl. vault files + 17/18) → Murray SSO sign-in + promote to sole super_admin → backfill (9 → Murray) → add bpg-ant as 2nd super_admin → flip `13`+`15` + bucket→private → smoke test (must include "a non-admin agent can create a listing"). Murray's Claude verifies each gate.
3. **Post-migration:** set repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (activates the prod-RLS CI gate); at launch do the Vercel Pro upgrade + env-var fix.

## Branching rules (from AGENTS.md — authoritative)

- Never edit `main` directly. Branch first: `<type>/<owner>-<slug>` where type = `feat|fix|chore|ops`, owner = `murray|ant`.
- One scope per branch. Open a **Draft PR** as the "I'm working here" signal the moment the branch has a commit.
- Before touching a file: `gh pr list` + read this file's "Who is working on what" / TASKS.md "In Progress" to avoid collisions.

## Commit / pull request rules

- **Code PRs:** cross-reviewed by the *other* side (ant/* → Murray, murray/* → bpg-ant). Squash-merge. Delete branch after. No self-approve on code.
- **Coordination/governance/docs files** (this file, TASKS.md, README, docs): Lead Integrator may self-merge once CI is green (Decision #8).
- PR description must state: what changed, why, how to test, DB/schema impact, screenshots if UI.
- Secrets never committed. Schema changes ship as migration SQL with apply+rollback notes; a human runs them against Supabase.
- Every meaningful chunk of work ends with: code committed + clear message + CI green + **PROJECT_SYNC.md and TASKS.md updated**.
