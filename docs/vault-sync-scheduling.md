# Vault sync scheduling

`api/sync-vault-listings.js` is the function that pulls active listings from VaultRE and writes them into the `vault_listings` cache tables on Supabase. It is currently **unscheduled** — Vercel cron jobs are a Pro-plan feature and the current deployment is on Hobby.

## How it runs today

- **Manual trigger** — anyone with access to the deployment can `curl` or `POST` to `/api/sync-vault-listings` to run a sync. Accepts both `GET` and `POST` so a browser open-tab works too.
- **External cron** — Antony's existing `~/.openclaw` pipeline already pulls Vault data via a separate path; that continues to populate the systems that depend on it.

## Re-enabling cron when on Vercel Pro

When the project moves to a Vercel Pro plan (or transfers to a Pro team), re-enable the cron by adding the `crons` array back to `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["syd1"],
  "crons": [
    {
      "path": "/api/sync-vault-listings",
      "schedule": "0 * * * *"
    }
  ],
  "functions": {
    "api/sync-vault-listings.js": {
      "maxDuration": 60
    }
  }
}
```

Schedule is hourly. Adjust if needed — Vault's REST API has rate limits but hourly is well within them.

## Authentication

The `/api/sync-vault-listings` endpoint **requires** an `Authorization: Bearer <CRON_SECRET>` header on every call. Requests without it return 401. The handler does a constant-time comparison against the `CRON_SECRET` env var (see line ~107 of `api/sync-vault-listings.js`).

This means:

- **Manual triggers** (browser tab, `curl`, anything ad-hoc) must include the bearer. A browser visit alone won't work — you need a tool that sets the header, e.g. `curl -H "Authorization: Bearer <secret>" https://<deploy>/api/sync-vault-listings`.
- **Vercel cron (when re-enabled on Pro)** automatically sets the bearer if `CRON_SECRET` is set as a Vercel environment variable. No extra config needed.
- **No further auth changes needed at Pro upgrade** — the bearer check is already in place.

### Required Vercel environment variables

The function errors out at request time if any of these are missing. All must be set in the Vercel project's environment variables, in every environment (Production, Preview, Development):

| Variable | Source |
|---|---|
| `VAULTRE_API_KEY` | Antony's `~/.openclaw/workspace/config/vault_fetcher.json` (`api_key`) |
| `VAULTRE_BEARER_TOKEN` | Same file (`bearer_token`) |
| `CRON_SECRET` | Generate a random ≥32-char string. Same value goes into the `Authorization: Bearer …` header for any manual or cron call. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` for the target Supabase project (staging or prod) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → secret key. **Never** ship to the browser. The function uses it to bypass RLS for the cache writes. |

## Alternatives considered

- **pg_cron + HTTP from Supabase to Vercel endpoint** — blocked by Vercel Deployment Protection on Hobby; the endpoint returns 401 to any external caller.
- **Supabase Edge Function port** — viable but a significant rewrite of the existing Node function; deferred.
