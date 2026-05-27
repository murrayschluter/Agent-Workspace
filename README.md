# Listing Portal

Listing lifecycle management for Blac Property Group — track each property from "Form 6 signed" through to settlement, with AI-generated vendor touchpoints (Monday Report emails + Wednesday/Friday SMS) and document storage.

Single-user (Murray) for now. No auth.

## Stack

- **Frontend:** React 19 + Vite 6.4 + Tailwind v4 + React Router 7
- **Backend:** Supabase (Postgres + Storage)
- **AI:** Anthropic Claude `claude-sonnet-4-6` via Vercel-style serverless functions in `/api/`
- **SMS:** ClickSend (alphanumeric / mobile sender)
- **Email:** Code present for Resend but disabled in UI (copy-paste flow for now)
- **Hosting:** Vercel (not yet deployed)

## Quick start

```bash
# 1. Clone + install
git clone <repo-url>
cd listing-portal
npm install

# 2. Copy the env template
cp .env.example .env
# Then edit .env and fill in real values (see below)

# 3. Set up the database (one-time)
# Open https://supabase.com/dashboard, open the SQL Editor, and run each
# file in supabase/ in this order:
#   1. schema.sql
#   2. triggers.sql
#   3. documents.sql
#   4. custom_tasks.sql
#   5. listing_services.sql
#   6. (optional) seed.sql  — adds three [DEMO] listings for visual testing

# 4. Run
npm run dev
# → http://localhost:5173
```

## Env vars (`.env`)

See `.env.example` for the full list. Minimum to run:

| Var | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → Publishable key |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |
| `CLICKSEND_USERNAME` + `CLICKSEND_API_KEY` | ClickSend dashboard → API Credentials |
| `SMS_SENDER_NAME` | Either alphanumeric (max 11 chars, e.g. `Murray`) OR a verified AU mobile number (e.g. `0498 333 604`) |

**Two ways to share env values across collaborators:**

1. **Shared backend** — copy the same `.env` between you. Simplest. You're both writing to the same Supabase + same SMS/AI accounts. Use for "two people building together on the same data."
2. **Separate environments** — each collaborator creates their own Supabase project + own API keys. Cleaner separation. Run each SQL file in your own project once. Use for "two people building in parallel without stepping on each other."

Never commit `.env`. It's in `.gitignore`.

## Architecture overview

```
src/
├── App.jsx                          # Router + Layout (sidebar + Outlet)
├── pages/
│   ├── Dashboard.jsx                # 4 stage sections + Today + Needs attention
│   └── ListingDetail.jsx            # Per-listing detail page
├── components/
│   ├── Sidebar.jsx                  # Nav + counts + New Listing modal
│   ├── NewListingModal.jsx
│   ├── NeedsAttention.jsx           # Proactive AI flags (rule-based, no API call)
│   ├── TodayTasks.jsx               # Conditions + touchpoints + custom tasks due today
│   ├── OffMarketCard.jsx
│   ├── OnTheMarketCard.jsx
│   ├── UnderContractCard.jsx        # With inline Complete + Extend per condition
│   ├── ArchivedCard.jsx
│   ├── UrgencyDot.jsx
│   ├── Card.jsx                     # Shared card wrapper
│   └── detail/
│       ├── PropertyInfo.jsx
│       ├── Notes.jsx                # Free-form scratch pad per listing
│       ├── StageProgression.jsx     # Stepper + transition buttons + Fell Over
│       ├── ConditionTracker.jsx     # Conditions w/ Complete/Extend/Add/Delete
│       ├── WeeklyLog.jsx            # Add/edit/delete weekly entries
│       ├── Documents.jsx            # Upload + per-listing storage
│       ├── Services.jsx             # Photographer, sign, conveyancer, etc.
│       ├── TouchpointHistory.jsx    # Generate/edit/send via SMS/mark sent
│       └── ContractModal.jsx        # Triggered when moving to Under Contract
├── hooks/
│   ├── useListings.js               # Dashboard data
│   ├── useListing.js                # Detail page data
│   └── useCustomTasks.js
├── lib/
│   ├── supabase.js                  # Singleton client
│   ├── listings.js                  # CRUD + getListingFull(id)
│   ├── contracts.js                 # CRUD + auto-deactivate prior active
│   ├── weeklyLogs.js
│   ├── touchpoints.js
│   ├── touchpointAI.js              # Frontend wrapper for /api/generate-touchpoint
│   ├── touchpointSend.js            # Frontend wrapper for /api/send-touchpoint
│   ├── customTasks.js
│   ├── documents.js                 # Supabase Storage helpers
│   ├── listingServices.js
│   ├── stageHistory.js
│   └── format.js                    # Date/currency/label helpers
├── index.css                        # Tailwind v4 + @theme palette
└── main.jsx

api/                                 # Vercel-style serverless functions
├── generate-touchpoint.js           # Calls Claude with listing + log + open home PDFs
└── send-touchpoint.js               # Sends SMS via ClickSend (or email via Resend)

supabase/                            # SQL setup files (run in Supabase SQL editor)
├── schema.sql                       # Tables, enums, RLS-disabled
├── triggers.sql                     # Auto-record stage_history on listings updates
├── documents.sql                    # Documents table + Storage bucket
├── custom_tasks.sql                 # custom_tasks + scratch_notes column
├── listing_services.sql             # listing_services table
└── seed.sql                         # Optional demo data

vite.config.js                       # React + Tailwind v4 + local-api plugin
```

## Database schema

7 tables: `listings`, `weekly_logs`, `contracts`, `touchpoints`, `stage_history`, `documents`, `custom_tasks`, `listing_services`.

Enums: `listing_stage`, `campaign_type`, `touchpoint_type`, `document_category`, `service_type`.

RLS is **disabled** on all tables (V1, single user). Adding auth + RLS policies is a Vercel-deploy prerequisite.

Storage bucket: `listing-documents` (public, 10MB file limit, files keyed by UUID).

## Stage lifecycle

```
Listed → Photos Taken → [Tenants Contacted, if tenanted] → Launched Online
       → Under Contract → Unconditional → Settlement → Archived
```

Fell-over button reverts Under Contract / Unconditional / Settlement back to `launched_online` and marks the active contract as `is_active = false` (history preserved).

## How the AI touchpoint generation works

`/api/generate-touchpoint.js` receives:
- Listing context (address, vendors' first names, days on market, campaign type)
- Most recent weekly log
- Previous draft content (only on Regenerate)
- Open home report PDFs uploaded in the last 14 days

Claude reads PDFs natively as document blocks. System prompt enforces Murray's voice rules (no em dashes, plain-spoken, Australian English, first names only). System prompt is cached (`cache_control: ephemeral`).

Three touchpoint types: Monday Report (email, ~10–15 sentences), Wednesday SMS, Friday SMS (each 2–4 sentences).

## Deployment

Not yet deployed. Vercel is the target — `/api/*.js` files work as Vercel serverless functions natively. The custom Vite plugin in `vite.config.js` only matters for local dev.

Before going live: decide on access control (Supabase Auth + RLS policies, or Vercel password protection, or keep URL private).

## Conventions

- Tailwind v4 with `@theme` block in `src/index.css` for the navy/cream/gold palette
- Cards stack vertically (full-width), info flows horizontally within each card
- No em dashes in any AI-generated copy (vendor voice rule)
- snake_case in DB → kept snake_case in JS (no field mapping)
- All form errors thrown from lib functions; UI catches and displays
