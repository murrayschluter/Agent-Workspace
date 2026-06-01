# TASKS.md — Working board

> Source of truth for who's doing what. Update this whenever you pick up / finish / block a task. Pair with `PROJECT_SYNC.md`. Last updated: **2026-06-01** by bpg-ant / Riyad's Claude (was: Murray's Claude).
>
> Owner tags: **MC** = Murray's Claude (claude-a) · **BA** = bpg-ant / Riyad's Claude (claude-b) · **H** = human (Murray/Antony).

---

## Needs Human Decision
- **[H] Schedule the joint prod-migration session.** Needs Murray (SSO sign-in + watching) + bpg-ant (driving SQL). Only true blocker to go-live. (PROJECT_SYNC Open Q1)
- **[H] At launch:** Vercel → Pro (re-enable Vault cron) and optionally Supabase → Pro (managed backups). Spend decisions. (issue #20)

## Blocked
- **[H] Vault cron live** — blocked on Vercel Pro upgrade (Hobby rejects hourly cron + maxDuration:60). Code merged (#16), cron intentionally disabled. Tracked: issue #20.

## In Progress
- **[BA→MC] Joint prod runbook execution** (issue #20) — backup is now DONE (see below), so the only remaining gate is a session window with Murray (SSO sign-in). Phases C–E are human-gated (security + irreversible RLS flip). Ready to drive the moment Murray's in the session.

## Ready to Start
- **[MC] Post-migration: activate prod-RLS CI gate** — after the flip, set repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` so `.github/workflows/verify-prod-rls.yml` becomes load-bearing. (Secret-setting is a human/dashboard step; MC documents + verifies.)
- **[MC] Post-migration: activate prod-RLS CI gate** — after the flip, set repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` so `.github/workflows/verify-prod-rls.yml` becomes load-bearing. (Secret-setting is a human/dashboard step; MC documents + verifies.)

## Backlog
- **[H/BA] Vercel env-var fix** (do at launch): rename `VAULT_API_KEY`→`VAULTRE_API_KEY`, `VAULT_API_TOKEN`→`VAULTRE_BEARER_TOKEN`; add `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Else manual sync invocations 500.
- **[BA] Re-enable Vault cron** in `vercel.json` after Vercel Pro (one-paste, documented in `docs/vault-sync-scheduling.md`).
- **[MC] Cosmetic doc nit** on `docs/vault-sync-scheduling.md`: the "browser open-tab works too" line contradicts the (correct) auth section — trim it. Low priority.
- **[BA] Storage UUID-regex robustness** in `listing_id_from_storage_path` (tighten to canonical 8-4-4-4-12). Low priority, error-closes today.
- **[future] Application 2FA / stronger auth** — next stream after launch (own brainstorm + spec).
- **[future] Reconcile claude-a/claude-b naming** with the murray/ant convention if the team wants to formalise it (currently mapped, not renamed).

## Done (recent — full history in merged PRs #2–#25)
- **[BA] Pre-migration prod backup (2026-06-01)** — logical data export of all prod base tables via the Management API (read-only): 44 rows (9 listings, 6 contracts, 16 touchpoints, 4 weekly_logs, 9 stage_history; documents/custom_tasks/listing_services empty) + `storage.buckets` config. Saved to `~/Blac/prod-backups/prod-data-backup-2026-06-01.json` on the bpg-ant machine (NOT committed — holds real vendor/contract data), sha256 `9521233b…3ef`. This is the at-risk-data safety net; see PROJECT_SYNC "Decisions" for why a logical export suffices in place of a full pg_dump. RBAC enforcement also empirically verified on staging (cross-agent isolation, owner-can't-delete, viewer read-only) before this.
- Governance scaffolding + branch protection + CI guard (#2, #3)
- Auth/RBAC schema, SSO, RLS policies, admin override, audit log, user mgmt, sharing UI (#4–#9, #12–#15, #18, #19)
- Vault cache schema + sync function + cron config + vault RLS (#10, #11, #16, #18)
- Phase 5 owner_id backfill migration (#21)
- Post-flip hotfixes: RLS recursion (#22), input contrast (#23), owner_id-on-insert (#24), created_by stamping (#25)
- Prod Microsoft SSO enabled + verified; redirect allowlist set
- bpg-ant granted Supabase org access (via `screechai@gmail.com`)
- Prod runbook authored + pre-flight checks (vault file ordering, @blacpg email gate, public-bucket hardening) — issue #20
