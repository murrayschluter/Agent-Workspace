# TASKS.md — Working board

> Source of truth for who's doing what. Update this whenever you pick up / finish / block a task. Pair with `PROJECT_SYNC.md`. Last updated: **2026-06-01** by Murray's Claude (Lead Integrator).
>
> Owner tags: **MC** = Murray's Claude (claude-a) · **BA** = bpg-ant / Riyad's Claude (claude-b) · **H** = human (Murray/Antony).

---

## Needs Human Decision
- **[H] Schedule the joint prod-migration session.** Needs Murray (SSO sign-in + watching) + bpg-ant (driving SQL). Only true blocker to go-live. (PROJECT_SYNC Open Q1)
- **[H] At launch:** Vercel → Pro (re-enable Vault cron) and optionally Supabase → Pro (managed backups). Spend decisions. (issue #20)

## Blocked
- **[BA] Prod migration Phase B–E** — blocked on the `pg_dump` backup being taken + confirmed (no managed snapshot on Supabase Free). Requested on issue #20. Unblocks the whole runbook.
- **[H] Vault cron live** — blocked on Vercel Pro upgrade (Hobby rejects hourly cron + maxDuration:60). Code merged (#16), cron intentionally removed from `vercel.json`. Tracked: issue #20.

## In Progress
- **[BA] pg_dump prod backup** — requested 2026-06-01 on issue #20; awaiting confirmation it's saved.

## Ready to Start
- **[BA→MC] Joint prod runbook execution** (issue #20) — ready the moment the pg_dump lands + a session window is set. Run-of-show + verify gates written on #20; apply order corrected twice (vault schema files; files 17/18). **23 auth files (01–18) + 5 vault files.**
- **[MC] Post-migration: activate prod-RLS CI gate** — after the flip, set repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` so `.github/workflows/verify-prod-rls.yml` becomes load-bearing. (Secret-setting is a human/dashboard step; MC documents + verifies.)

## Backlog
- **[H/BA] Vercel env-var fix** (do at launch): rename `VAULT_API_KEY`→`VAULTRE_API_KEY`, `VAULT_API_TOKEN`→`VAULTRE_BEARER_TOKEN`; add `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Else manual sync invocations 500.
- **[BA] Re-enable Vault cron** in `vercel.json` after Vercel Pro (one-paste, documented in `docs/vault-sync-scheduling.md`).
- **[BA] Storage UUID-regex robustness** in `listing_id_from_storage_path` (tighten to canonical 8-4-4-4-12). Low priority, error-closes today.
- **[future] Application 2FA / stronger auth** — next stream after launch (own brainstorm + spec).
- **[future] Reconcile claude-a/claude-b naming** with the murray/ant convention if the team wants to formalise it (currently mapped, not renamed).

## Done (recent — full history in merged PRs #2–#26)
- **Project reset: coordination files** `PROJECT_SYNC.md` + `TASKS.md` (#26)
- **Docs refresh** (this branch `chore/murray-docs-refresh`): README updated to reflect built auth/RBAC + Vault + deployed status (was "single-user, no auth, not deployed"); fixed vault-sync doc's false "browser open-tab works" line (endpoint requires CRON_SECRET).
- **Runbook corrections on issue #20** (Lead Integrator coherence pass): added the `supabase/vault/` schema files to the apply order (would've failed at `14b`); added `17_set_listing_owner_on_insert` (CRITICAL — agents can't create listings post-flip without it) + `18_stamp_created_by_children`; plus the @blacpg SSO email gate + public-bucket→private hardening.
- Governance scaffolding + branch protection + CI guard (#2, #3)
- Auth/RBAC schema, SSO, RLS policies, admin override, audit log, user mgmt, sharing UI (#4–#9, #12–#15, #18, #19)
- Vault cache schema + sync function + cron config + vault RLS (#10, #11, #16, #18)
- Phase 5 owner_id backfill migration (#21)
- Post-flip hotfixes: RLS recursion (#22), input contrast (#23), owner_id-on-insert (#24), created_by stamping (#25)
- Prod Microsoft SSO enabled + verified; redirect allowlist set; bpg-ant granted Supabase org access
