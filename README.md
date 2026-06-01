# Listing Portal

Listing lifecycle management for Blac Property Group — track each property from "Form 6 signed" through to settlement, with AI-generated vendor touchpoints (Monday Report emails + Wednesday/Friday SMS), document storage, and an optional read-only VaultRE listing cache.

> **Coordination:** `PROJECT_SYNC.md` and `TASKS.md` at the repo root are the source of truth for current state, decisions, and who's working on what. Read them first. The production go-live runbook lives in **GitHub issue #20**.

## Status (2026-06-01)

- **Auth/RBAC: built and merged, not yet applied to production.** Microsoft SSO (Entra) + role-based access (super_admin / agent / pending), per-listing collaborators, admin override, audit log, and full RLS policies are all in the codebase (`supabase/auth/`). They run/verify on staging. The production database migration (apply schema → bootstrap super_admin → backfill → flip RLS) is pending a joint session — see issue #20.
- **Deployed** on Vercel (Hobby plan), behind Vercel Deployment Protection (logged-out visitors get a 401). Production Supabase project: `jdsbqfccdgipnlvcpgva`.
- **VaultRE integration:** read-only cache + sync function built (`supabase/vault/`, `api/sync-vault-listings.js`). Hourly cron is Pro-only, so it's disabled on Hobby — see `docs/vault-sync-scheduling.md`.

## Stack

- **Frontend:** React 19 + Vite 6.4 + Tailwind v4 + React Router 7
- **Auth:** Supabase Auth → Microsoft (Azure/Entra) SSO, `@blacpg.com.au` only; app-level roles in `profiles`
- **Backend:** Supabase (Postgres + Storage), Row Level Security
- **AI:** Anthropic Claude `claude-sonnet-4-6` via Vercel-style serverless functions in `/api/`
- **SMS:** ClickSend (alphanumeric / mobile sender)
- **Email:** Code present for Resend but disabled in UI (copy-paste flow for now)
- **Hosting:** Vercel (Hobby)

## Quick start (local dev)

```bash
git clone <repo-url>
cd listing-portal
npm install
cp .env.example .env   # fill in real values (see Env vars)
npm run dev            # → http://localhost:5173
```

Local dev can point at staging or prod Supabase via `.env`. Signing in requires the Microsoft SSO provider to be enabled on the target Supabase project and your origin in its redirect allowlist.

### Database setup

SQL lives in `supabase/`, applied via the Supabase SQL editor. Two layers:

1. **Base schema** (the original single-user app): `schema.sql` → `triggers.sql` → `documents.sql` → `custom_tasks.sql` → `listing_services.sql` (+ optional `seed.sql`).
2. **Auth/RBAC + Vault** (`supabase/auth/` 01–18 and `supabase/vault/` 01–05): the ordered migration chain that adds profiles/roles/collaborators/audit-log, ownership columns, helper functions, triggers, RLS policies, the Vault cache tables, and finally `15_enable_rls.sql` (the RLS "flip"). **Apply order and preconditions are documented in issue #20 — do not freehand this against production.** Files are idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`).

## Env vars (`.env`)

See `.env.example`. Frontend minimum: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus `VITE_SITE_URL` for OAuth redirects. Server/API: `ANTHROPIC_API_KEY`, `CLICKSEND_USERNAME` + `CLICKSEND_API_KEY`, `SMS_SENDER_NAME`. Vault sync (server): `VAULTRE_API_KEY`, `VAULTRE_BEARER_TOKEN`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (see `docs/vault-sync-scheduling.md`).

Never commit `.env`. It's in `.gitignore`. Secrets go in the Vercel/Supabase dashboards, never in the repo.

## Auth & access model

- **Sign-in:** Microsoft SSO, restricted to `@blacpg.com.au`. The `provision_profile` trigger auto-creates a `pending` profile on first sign-in.
- **Roles:** `super_admin` (full access + admin tools), `agent` (own + collaborated listings), `pending` (awaiting activation → held at an awaiting-access screen).
- **Per-listing sharing:** `listing_collaborators` grants `viewer` / `editor` / `co_owner`.
- **DELETE is super_admin-only** across listings + all child tables (anti-leaver safety — an agent leaving can't destroy records).
- **Admin override:** super_admins get a "view as agent" mode; every transition is written to `admin_access_log` (immutable, super_admin-readable).
- Enforcement is RLS in Postgres; the React layer mirrors it for UX. RLS is enabled by `supabase/auth/15_enable_rls.sql` (the production flip is pending).

## Database schema

**Base tables:** `listings`, `weekly_logs`, `contracts`, `touchpoints`, `stage_history`, `documents`, `custom_tasks`, `listing_services`.
**Auth/RBAC tables:** `profiles`, `listing_collaborators`, `admin_access_log`.
**Vault cache tables:** `vault_listings`, `vault_listing_agents`, `vault_sync_runs`, `vault_agent_aliases`.

Ownership/audit columns (`owner_id`, `created_by`, `updated_by`) added to `listings` + children. Storage bucket: `listing-documents` (being flipped to **private** during the RLS migration so the storage policies actually enforce; files keyed by `listings/{listing_id}/{filename}`).

## Stage lifecycle

```
Listed → Photos Taken → [Tenants Contacted, if tenanted] → Launched Online
       → Under Contract → Unconditional → Settlement → Archived
```

Fell-over reverts Under Contract / Unconditional / Settlement back to `launched_online` and marks the active contract inactive (history preserved). Non-super-admins archive (stage → `archived`) rather than delete.

## How the AI touchpoint generation works

`/api/generate-touchpoint.js` receives listing context (address, vendors' first names, days on market, campaign type), the most recent weekly log, previous draft (on Regenerate), and open-home report PDFs from the last 14 days. Claude reads PDFs natively as document blocks. The system prompt enforces Murray's voice rules (no em dashes, plain-spoken, Australian English, first names only) and is cached (`cache_control: ephemeral`). Three types: Monday Report (email), Wednesday SMS, Friday SMS.

## VaultRE sync

`api/sync-vault-listings.js` pulls active VaultRE listings into the `vault_*` cache (read-only against Vault: GET-only, host/path allow-listed). Auth: `Authorization: Bearer <CRON_SECRET>` (constant-time check). Scheduling/env details in `docs/vault-sync-scheduling.md`.

## Deployment

Live on Vercel (Hobby), behind Deployment Protection. `/api/*.js` run as Vercel serverless functions; the Vite plugin in `vite.config.js` only matters for local dev. Go-live checklist (Vercel Pro for the cron, prod RLS flip, env-var fixes, super_admin bootstrap) is tracked in **issue #20**.

## Conventions

- Tailwind v4 with `@theme` block in `src/index.css` for the navy/cream/gold palette
- No em dashes in any AI-generated / vendor-facing copy (voice rule)
- snake_case in DB → kept snake_case in JS (no field mapping)
- All form errors thrown from lib functions; UI catches and displays
- Branching / PR / review rules: see `AGENTS.md` and `PROJECT_SYNC.md`
