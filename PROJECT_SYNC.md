# PROJECT_SYNC.md — Coordination source of truth

> **Read this first, every session.** This file + `TASKS.md` are how the two Claude agents coordinate. GitHub is the source of truth — not chat, not email. Last updated: **2026-06-01** by bpg-ant / Riyad's Claude (prior: Murray's Claude, Lead Integrator).

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

- **Code phase is COMPLETE.** Every PR #2–#25 is merged. No open PRs. `main` == what's running/validated on staging Supabase.
- The app is deployed on **Vercel (Hobby plan)**; production URL `agent-workspace-blacpg-s-projects.vercel.app` (behind Vercel Deployment Protection → 401 to logged-out visitors).
- **Prod Supabase project = `jdsbqfccdgipnlvcpgva`** ("Murray Work Dash"). It holds **real data** (9 listings, 16 touchpoints, 6 contracts, 4 weekly logs, 9 stage-history rows). Base schema only — **none of the auth/RBAC migration chain is applied to prod yet**; `auth.users` is empty.
- **Microsoft SSO (Azure) is enabled + verified on prod** (authorize endpoint 302s to Microsoft correctly). Redirect allowlist has `http://localhost:5173` + the prod URL.
- The **prod data migration is staged + de-risked, paused at the snapshot/session gate** — see "Next best actions". **Pre-migration backup is now DONE** (2026-06-01, by bpg-ant): a logical data export of all prod base tables via the Management API — 44 rows + `storage.buckets` config — saved locally on the bpg-ant machine at `~/Blac/prod-backups/prod-data-backup-2026-06-01.json` (sha256 `9521233b…3ef`, NOT committed — real vendor data). The migration is now blocked only on a **session window with Murray** (his SSO sign-in for the super_admin bootstrap). The executable migration is pre-built as phase scripts in the specs repo (PHASE-B-schema / PHASE-D-backfill / PHASE-E-flip / ROLLBACK-and-smoketest), concatenated from the exact merged files and validated against prod's real schema.

## What has already been completed

- **Governance scaffolding** (#2, #3): `AGENTS.md`, PR/issue templates, branch-protection ruleset on `main`, CI workflow that fails any PR if `main` protection is removed.
- **Stream B.1 — Auth/RBAC** (#4–#9, #12–#15, #18, #19, #22, #24, #25): enums/profiles/collaborators/audit-log schema, ownership columns, helper functions, triggers, Microsoft SSO + role-aware AuthGate, awaiting-access screen, ProfileMenu, admin override mechanics, sharing UI, AuditLog + UserManagement pages, the invite-picker RPC, all RLS policies, and the **Phase 6 RLS-flip file** (`15_enable_rls.sql`). Post-flip hotfixes: RLS recursion (#22), owner_id-on-insert (#24), created_by stamping (#25), input contrast (#23).
- **Stream B.2 — Vault read integration** (#10, #11, #16, #18): vault cache schema, the read-only sync function (`api/sync-vault-listings.js`, secret-safe, CRON_SECRET-gated), Vercel cron config (cron itself disabled on Hobby — see Decisions), and vault RLS policies.
- **Phase 5 backfill** (#21): `14_backfill_owner_id.sql` — assigns NULL-owner legacy listings to the sole super_admin, with the `prevent_owner_reassign` trigger disabled/re-enabled around the UPDATE.
- **Prod SSO config** enabled + verified; **prod runbook** authored (on issue #20).

## What is broken or uncertain

- **Nothing is broken in code.** `main` is green (all CI passing) and == staging.
- **Uncertain / pending verification:** the prod migration hasn't run, so the RLS policies are unproven against prod's real data shape (they passed on staging). Mitigation: the run-of-show on #20 has a verify gate after every step + a `pg_dump` rollback.
- **Vercel env-var name mismatch** (deferred, harmless on Hobby): Vercel has `VAULT_API_KEY`/`VAULT_API_TOKEN` but the function reads `VAULTRE_API_KEY`/`VAULTRE_BEARER_TOKEN` (+ missing `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Fix at launch — see TASKS.md.

## Decisions made

1. **`main` protection = ruleset** (1 approval, linear history, no force-push/deletion). Classic protection removed (was redundant). Verified via `gh api`.
2. **Self-merge bypass actors added** (Repository admin + Write role, "for pull requests only") so each side can merge own PRs without waiting on the human — for **momentum when the other is away**. Force-push/deletion of `main` still blocked.
3. **Prod Supabase = `jdsbqfccdgipnlvcpgva`** is THE prod project (supersedes the earlier idea of bpg-ant standing up a separate one).
4. **Listing ownership: all 9 prod listings are Murray's.** No split. Phase 5 backfill runs unchanged (all orphans → Murray).
5. **Vercel stays on Hobby until launch**, then upgrade to Pro to enable the hourly Vault cron (#16 is cron-disabled on Hobby; tracked in issue #20). *Assumption made:* daily/manual sync is acceptable pre-launch. *Reason:* app isn't live; openclaw pipeline covers data pulls. *Risk:* low (no users). *How to change:* re-add `crons[]` to `vercel.json` after Pro upgrade.
6. **Supabase prod is on Free tier → no managed backups.** Pre-migration backup = a **logical data export via the Management API** (done 2026-06-01), in place of a full `pg_dump`. *Assumption made:* the logical data export is a sufficient backup. *Reason:* the migration is additive — it ADDs tables/columns and only mutates `owner_id` (NULL→Murray) + RLS/bucket flags, all reversible; no existing row data is deleted or transformed, so the at-risk surface is exactly the row data, which the export captures in full (44 rows). Schema lives in git. *Risk:* low — a full `pg_dump` would also capture roles/sequences/grants, not at risk here; the agent lacks the direct-connection DB password for `pg_dump`. *How to change later:* Antony runs `pg_dump` with the Supabase connection string before the flip for belt-and-suspenders.
7. **Branch convention kept as `<type>/<owner>-<slug>`** (murray/ant), NOT switched to claude-a/claude-b. *Reason:* 24 merged PRs, the protection ruleset, and the review-routing all depend on it. The claude-a/claude-b labels map to murray/ant respectively (see table above).
8. **Lead Integrator may self-merge SAFE coordination/governance files** (this file, `TASKS.md`, docs) using the admin bypass. *Code* changes still require cross-review (ant/* → Murray, murray/* → bpg-ant) — that cross-review has caught real bugs (#11, #6, #18, #22) and stays mandatory.

## Open questions for the human (Murray)

1. **When can the joint prod-migration session run?** It needs Murray (SSO sign-in + watching) + bpg-ant (driving SQL). Currently the only true blocker to going live.
2. **At launch:** upgrade Vercel → Pro (re-enable cron) and optionally Supabase → Pro (managed backups/PITR for client data)? Both are spend decisions.

*(Everything else is being decided by the agents and recorded here — per the reset, stop routing small choices through Murray.)*

## Next best actions

1. ~~**bpg-ant:** run the prod backup~~ — **DONE 2026-06-01** (logical export, see Decisions #6). Phase B unblocked.
2. **Joint session (Murray + bpg-ant) — the only remaining gate to go-live:** execute the prod runbook on issue #20 — backup (done) → Phase B: schema+policies (RLS off, vault files included) → **Murray SSO sign-in (@blacpg.com.au) + promote to sole super_admin** → Phase D backfill (9 → Murray) → add bpg-ant as 2nd super_admin → Phase E flip (`13`+`15`) + bucket→private → smoke test. bpg-ant drives the SQL (phase scripts pre-built in specs repo); Murray's Claude verifies each gate. **Phases C–E are human-gated** (Murray must sign in; the RLS flip is security + irreversible). Murray was reported available 2026-06-01 — set the window and run it.
3. **Post-migration:** set repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (activates the prod-RLS CI gate); at launch do the Vercel Pro upgrade + env-var fix.

## Branching rules (from AGENTS.md — authoritative)

- Never edit `main` directly. Branch first: `<type>/<owner>-<slug>` where type = `feat|fix|chore|ops`, owner = `murray|ant`.
- One scope per branch. Open a **Draft PR** as the "I'm working here" signal the moment the branch has a commit.
- Before touching a file: `gh pr list` + read this file's "Who is working on what" / TASKS.md "In Progress" to avoid collisions.

## Commit / pull request rules

- **Code PRs:** cross-reviewed by the *other* side (ant/* → Murray, murray/* → bpg-ant). Squash-merge. Delete branch after. No self-approve on code.
- **Coordination/governance files** (this file, TASKS.md, docs): Lead Integrator may self-merge once CI is green (Decision #8).
- PR description must state: what changed, why, how to test, DB/schema impact, screenshots if UI.
- Secrets never committed. Schema changes ship as migration SQL with apply+rollback notes; a human runs them against Supabase.
- Every meaningful chunk of work ends with: code committed + clear message + CI green + **PROJECT_SYNC.md and TASKS.md updated**.
