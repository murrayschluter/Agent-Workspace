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

## Authentication note

The `/api/sync-vault-listings` endpoint is currently unauthenticated (anyone who can reach it can trigger a sync). On the Hobby plan that's fine because Vercel Deployment Protection wraps the whole deployment with a 401. If you upgrade to Pro and disable Deployment Protection, add a bearer-token check at the top of the handler before exposing the endpoint publicly.

## Alternatives considered

- **pg_cron + HTTP from Supabase to Vercel endpoint** — blocked by Vercel Deployment Protection on Hobby; the endpoint returns 401 to any external caller.
- **Supabase Edge Function port** — viable but a significant rewrite of the existing Node function; deferred.
