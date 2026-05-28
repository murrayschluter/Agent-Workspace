// api/sync-vault-listings.js
//
// Stream B.2 Phase V2 — Vault sync function.
// Source of truth: /Users/screech/Blac/agent-workspace-specs/2026-05-27-vault-integration-design.md (v2)
// V0 findings: /Users/screech/Blac/agent-workspace-specs/2026-05-27-vault-integration-findings.md
//
// What this does
// --------------
// Pulls active listings from VaultRE (status in 'current' | 'conditional' |
// 'unconditional') and caches them in vault_listings + vault_listing_agents.
// Logs the attempt in vault_sync_runs. Soft-deletes (status='withdrawn') any
// cached listing that disappears from Vault between runs.
//
// Why two auth headers, not one
// -----------------------------
// V0 confirmed Vault's REST API requires BOTH `X-Api-Key` and
// `Authorization: Bearer <token>` on every call. Single-header requests
// 401. See findings doc section 1.
//
// Read-only against Vault
// -----------------------
// Belt-and-braces: every Vault call goes through safeVaultFetch(), which
// hard-codes method=GET and refuses any path not in ALLOWED_VAULT_PATHS.
// If we ever need write-back, it goes in a separate function per AGENTS.md.
//
// Auth gate
// ---------
// Caller must send Authorization: Bearer <CRON_SECRET>. V3 will wire the
// Vercel cron to inject this automatically. Until then it's the only thing
// stopping drive-by invocations from chewing through Vault's rate limit.
// Compared with crypto.timingSafeEqual to avoid string-compare timing leaks.
//
// Supabase access
// ---------------
// Uses the service role key. The sync function is a privileged backend
// process and must bypass RLS — V4 will turn RLS on for these tables, and
// at that point only service-role can write to them. NEVER expose the
// service role to the client bundle (it lives only in process.env on the
// server-side function).
//
// Failure semantics
// -----------------
// - Per-request retries on 429/5xx with exponential backoff (2/4/8/16s).
//   Honours Retry-After if present.
// - After 4 retries on one request, mark the run 'partial' and continue —
//   we'd rather get most listings cached than crash and have no data.
// - If the function crashes uncaught between insert(run, 'running') and the
//   final update, the row stays at 'running'. The next run can identify
//   orphaned rows by started_at and absence of finished_at; this V2
//   function does not clean them up itself (intentional — see comment near
//   the run-creation block).

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VAULT_BASE = 'https://ap-southeast-2.api.vaultre.com.au';

// Path allow-list. safeVaultFetch refuses anything not matching a prefix here.
// Keep this tight — adding to it without security review is a footgun.
const ALLOWED_VAULT_PATHS = ['/properties/sale'];

// V0 confirmed these three statuses cover every listing an agent is actively
// working. Other Vault statuses (prospect, appraisal, sold, settled) are
// intentionally excluded — see findings doc section 2.
const STATUSES_TO_SYNC = ['current', 'conditional', 'unconditional'];

// V0 found ~16 listings across all three statuses combined. 50 leaves headroom
// without making any one request expensive. Vault accepts pagesize up to 200.
const PAGE_SIZE = 50;

// Defensive cap. We expect 1-2 pages per status at current scale; if we ever
// see >50 pages something has gone badly wrong and we'd rather bail than loop.
const MAX_PAGES_PER_STATUS = 50;

// Exponential backoff on 429/5xx. After this many attempts on a single
// request, we mark the run 'partial' and skip ahead — see findings section 5.
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

// Per-request timeout. Vault typically responds in <1s; this caps a hung
// connection so retries don't silently consume the function's budget. Combined
// with the retry delays above, worst case per Vault call is 20s + 30s of backoff
// = ~50s wall time. The cron deploy (V3) should set vercel.json maxDuration
// accordingly (Pro: 60s default; Hobby: 10s default — Hobby will not work).
const PER_REQUEST_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // Method gate — POST only. The Vercel cron sends POST by default.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Env gate — verify all 5 required env vars before doing anything else.
  // Never echo the values; just report which are missing by name.
  const env = readEnv();
  if (env.error) {
    return res.status(500).json({ error: env.error });
  }

  // Auth gate — constant-time comparison of the bearer token against CRON_SECRET.
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (!authorize(authHeader, env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Supabase client. Service role bypasses RLS (V4 will tighten this).
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Open a sync run row. If anything below throws uncaught, the row stays
  // 'running' as a visible breadcrumb (we don't try to repair it on next run;
  // a future job or the admin UI can sweep up orphans).
  const runId = await openSyncRun(supabase);
  if (!runId) {
    return res.status(500).json({ error: 'Could not open sync run' });
  }

  let runStatus = 'success';
  let errorMessage = null;
  const counts = {
    listings_pulled: 0,
    listings_created: 0,
    listings_updated: 0,
    listings_removed: 0,
  };

  try {
    // 1. Pull every active listing from Vault across all three statuses.
    const pulled = await pullAllActiveListings(env, (partialReason) => {
      // Called when a single request exhausts its retries. Don't crash — just
      // downgrade the run to 'partial' and keep going with what we have.
      runStatus = 'partial';
      // Defense-in-depth: scrub even though current partial reasons don't
      // currently contain secrets — keeps future error sources safe by default.
      if (!errorMessage) errorMessage = scrubSecrets(env, String(partialReason));
    });
    counts.listings_pulled = pulled.size;

    // 2. Resolve every Vault staff id to a Blac user_id where we can. Done in
    //    bulk so we don't make N round-trips to profiles + aliases per agent.
    const matchMap = await buildAgentMatchMap(supabase, pulled);

    // 3. Upsert listings and agent rows. Idempotent on second run.
    const { created, updated } = await upsertListings(supabase, pulled, matchMap);
    counts.listings_created = created;
    counts.listings_updated = updated;

    // 4. Soft-delete: anything in vault_listings whose id is NOT in this pull
    //    and is currently active gets marked 'withdrawn'. We don't DELETE
    //    rows — listings.vault_listing_id may still reference them.
    counts.listings_removed = await softDeleteMissing(supabase, pulled);
  } catch (e) {
    runStatus = 'failure';
    errorMessage = scrubSecrets(env, String(e?.message || e)) || 'Unknown error';
  } finally {
    // Final scrub pass — paranoid but cheap. Catches any path that wrote to
    // errorMessage without going through scrubSecrets.
    if (errorMessage) errorMessage = scrubSecrets(env, errorMessage);
    await closeSyncRun(supabase, runId, runStatus, counts, errorMessage);
  }

  return res.status(runStatus === 'failure' ? 500 : 200).json({
    run_id: runId,
    status: runStatus,
    ...counts,
    ...(errorMessage ? { error: errorMessage } : {}),
  });
}

// ---------------------------------------------------------------------------
// Env + auth
// ---------------------------------------------------------------------------

function readEnv() {
  const required = [
    'VAULTRE_API_KEY',
    'VAULTRE_BEARER_TOKEN',
    'CRON_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // Names only, never values. The Vercel logs are not a secret store.
    return { error: `missing env: ${missing.join(', ')}` };
  }
  return {
    VAULTRE_API_KEY: process.env.VAULTRE_API_KEY,
    VAULTRE_BEARER_TOKEN: process.env.VAULTRE_BEARER_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function authorize(authHeader, cronSecret) {
  // Expected: "Bearer <cronSecret>". Anything else fails.
  if (typeof authHeader !== 'string') return false;
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return false;
  const token = authHeader.slice(prefix.length);

  // Constant-time compare. Different-length buffers short-circuit in
  // timingSafeEqual, so we must check length first and fail-but-still-compare
  // to keep timing flat. Using Buffer.from with explicit 'utf8' so unicode
  // doesn't surprise us.
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(cronSecret, 'utf8');
  if (a.length !== b.length) {
    // Still run a constant-time compare against b so the early-return cost
    // doesn't leak a length signal. Then fall through to false.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Vault HTTP
// ---------------------------------------------------------------------------

/**
 * Read-only Vault GET. Refuses non-GET, refuses paths outside the allow-list,
 * retries on 429/5xx with exponential backoff, honours Retry-After.
 *
 * Returns parsed JSON on success. Throws on hard failure (4xx other than 429,
 * or 4 consecutive retryable failures).
 */
async function safeVaultFetch(env, urlOrPath) {
  // Accept either a relative path ('/properties/sale?status=current') or a
  // fully-qualified URL returned by Vault (urls.next). Normalise to a URL.
  let url;
  if (urlOrPath.startsWith('/')) {
    url = `${VAULT_BASE}${urlOrPath}`;
  } else if (urlOrPath.startsWith(`${VAULT_BASE}/`)) {
    url = urlOrPath;
  } else if (urlOrPath.startsWith('https://ap-southeast-2.api.vaultre.com.au/')) {
    // Same host, defensively allowed. Vault's urls.self / urls.next include
    // /api/v1.3/ — we accept that prefix from Vault's own responses.
    url = urlOrPath;
  } else {
    throw new Error(`safeVaultFetch: refusing non-Vault URL: ${urlOrPath}`);
  }

  // Allow-list the *path* (after stripping the host + optional /api/vX.Y prefix).
  const pathOnly = new URL(url).pathname.replace(/^\/api\/v[\d.]+/, '');
  const allowed = ALLOWED_VAULT_PATHS.some((p) => pathOnly.startsWith(p));
  if (!allowed) {
    throw new Error(`safeVaultFetch: path not in allow-list: ${pathOnly}`);
  }

  // Retry loop. delays.length attempts AFTER the initial try.
  const maxAttempts = RETRY_DELAYS_MS.length + 1;
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      await sleep(delay);
    }
    // Per-request timeout via AbortController. Vault has been responsive
    // (<1s typical) but a hung connection could otherwise consume the entire
    // function budget through repeated retries.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        method: 'GET', // hard-coded; do not parameterise.
        headers: {
          'X-Api-Key': env.VAULTRE_API_KEY,
          Authorization: `Bearer ${env.VAULTRE_BEARER_TOKEN}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (e) {
      // Network-level failure (DNS, connection reset, abort due to timeout).
      // Retry — but cap the retries via the outer loop so we don't keep
      // burning the function budget on a persistently dead endpoint.
      clearTimeout(timeoutId);
      lastErr = new Error(
        e?.name === 'AbortError'
          ? `Vault request timed out after ${PER_REQUEST_TIMEOUT_MS}ms`
          : `network error talking to Vault: ${e?.message || e}`
      );
      continue;
    }
    clearTimeout(timeoutId);

    if (response.ok) {
      try {
        return await response.json();
      } catch (e) {
        // Vault returned 200 but body wasn't valid JSON. Treat as a transient
        // failure and retry; if it persists, the outer loop will surface it.
        lastErr = new Error(`Vault returned non-JSON body (status ${response.status})`);
        continue;
      }
    }

    // 429 + 5xx are retryable. Honour Retry-After if Vault sends it.
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds > 0) {
          // Override the next backoff with the server-suggested delay.
          await sleep(Math.min(seconds * 1000, 60000));
          continue;
        }
      }
      lastErr = new Error(`Vault HTTP ${response.status}`);
      continue;
    }

    // Non-retryable: throw immediately (4xx other than 429). Do NOT include
    // the response body — it may echo our headers in some error formats.
    throw new Error(`Vault HTTP ${response.status} on ${pathOnly}`);
  }

  throw lastErr || new Error(`Vault retries exhausted on ${pathOnly}`);
}

/**
 * Pull every active listing from Vault across the three sync statuses.
 * Returns a Map<vault_listing_id, listing_item>.
 *
 * onPartial(reason) is called when a single status's pagination chain fails
 * after retries. We continue with what we have rather than dropping the run.
 */
async function pullAllActiveListings(env, onPartial) {
  const all = new Map();

  for (const status of STATUSES_TO_SYNC) {
    let nextUrl = `/properties/sale?status=${encodeURIComponent(status)}&pagesize=${PAGE_SIZE}&page=1`;
    let pages = 0;
    try {
      while (nextUrl && pages < MAX_PAGES_PER_STATUS) {
        const body = await safeVaultFetch(env, nextUrl);
        pages++;
        const items = Array.isArray(body?.items) ? body.items : [];
        for (const item of items) {
          // V0 finding 7.3: defensive filter — only cache our office's listings.
          // isOurListing was true on every observed row; if it ever flips to
          // false (account config change, cross-office data), skip it.
          if (item?.isOurListing === false) continue;
          if (!item?.id) continue;
          const vaultListingId = String(item.id);
          // De-dupe: a listing in multiple statuses would be a Vault bug, but
          // last write wins on the in-memory map either way.
          all.set(vaultListingId, item);
        }
        nextUrl = body?.urls?.next || null;
      }
      if (pages >= MAX_PAGES_PER_STATUS) {
        onPartial(`pagination cap reached for status=${status}`);
      }
    } catch (e) {
      // Per-status failure: log it, downgrade run to 'partial', continue with
      // remaining statuses. Better to have 2/3 statuses cached than 0/3.
      onPartial(`failed to pull status=${status}: ${e?.message || e}`);
    }
  }

  return all;
}

// ---------------------------------------------------------------------------
// Listing extraction
// ---------------------------------------------------------------------------

/**
 * Flatten a Vault listing item into the vault_listings row shape.
 * Field paths from V0 findings section 4.
 */
function extractListingRow(item) {
  // displayAddress is the canonical pre-formatted human string. Fall back to
  // a manual rebuild only if Vault ever stops sending it.
  const address =
    item.displayAddress ||
    [
      [item.address?.unitNumber, item.address?.streetNumber].filter(Boolean).join('/'),
      item.address?.street,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Unknown address';

  return {
    vault_listing_id: String(item.id),
    address,
    suburb: item.address?.suburb?.name || null,
    state: item.address?.state?.abbreviation || item.address?.state?.name || null,
    postcode: item.address?.suburb?.postcode || null,
    list_date: item.authorityStart || null,
    status: item.status, // already 'current'/'conditional'/'unconditional' per filter
    campaign_type: item.methodOfSale?.name || null,
    list_price_display: item.displayPrice || null,
    vault_url: item.eTableUrl || null,
    last_synced_at: new Date().toISOString(),
    raw_payload: item, // full object — RLS in V4 hides this from non-super_admins
  };
}

/**
 * Flatten contactStaff[] into vault_listing_agents rows.
 * matchedUserIdFor(staffId) returns the resolved user_id or null.
 */
function extractAgentRows(item, matchedUserIdFor) {
  const staff = Array.isArray(item.contactStaff) ? item.contactStaff : [];
  const out = [];
  const seen = new Set();
  for (const s of staff) {
    if (!s?.id) continue;
    const staffId = String(s.id);
    // De-dupe: same staff member appearing twice in contactStaff[] would
    // violate the (vault_listing_id, vault_staff_id) PK.
    if (seen.has(staffId)) continue;
    seen.add(staffId);
    out.push({
      vault_listing_id: String(item.id),
      vault_staff_id: staffId,
      vault_staff_email: s.email || null,
      matched_user_id: matchedUserIdFor(staffId, s.email) ?? null,
      is_primary: Boolean(s.isPrimary),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Agent auto-match
// ---------------------------------------------------------------------------

/**
 * Resolve every distinct vault_staff_id seen in this pull to a user_id, using:
 *   1. vault_agent_aliases (super_admin override) — highest priority
 *   2. profiles.vault_user_id === staff id
 *   3. profiles.email === staff email — LAST-RESORT FUZZY MATCH. This can
 *      mis-match if a Vault staff's email collides with a Blac user who
 *      genuinely shouldn't see those listings (rare in practice). Surface as
 *      a known caveat; super_admin can override with a vault_agent_alias.
 *   4. NULL — surfaced in the admin "unmatched" panel.
 *
 * Returns Map<staffId, user_id> + a helper to also try by email.
 */
async function buildAgentMatchMap(supabase, listingsMap) {
  // Collect all unique staff ids + emails up front, so we make 2 round-trips
  // instead of N per listing.
  const staffIds = new Set();
  const emailToStaffIds = new Map(); // lowercase email -> Set of staff ids
  for (const item of listingsMap.values()) {
    const staff = Array.isArray(item.contactStaff) ? item.contactStaff : [];
    for (const s of staff) {
      if (!s?.id) continue;
      const id = String(s.id);
      staffIds.add(id);
      if (s.email) {
        const k = String(s.email).toLowerCase();
        if (!emailToStaffIds.has(k)) emailToStaffIds.set(k, new Set());
        emailToStaffIds.get(k).add(id);
      }
    }
  }

  const idsArray = Array.from(staffIds);

  // Layer 1: aliases (super_admin overrides).
  const byAlias = new Map();
  if (idsArray.length > 0) {
    const { data, error } = await supabase
      .from('vault_agent_aliases')
      .select('vault_staff_id, user_id')
      .in('vault_staff_id', idsArray);
    if (error) {
      throw new Error(`vault_agent_aliases lookup failed: ${error.message}`);
    }
    for (const row of data || []) {
      byAlias.set(String(row.vault_staff_id), row.user_id);
    }
  }

  // Layer 2: profiles.vault_user_id match.
  const byVaultId = new Map();
  if (idsArray.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, vault_user_id')
      .in('vault_user_id', idsArray);
    if (error) {
      throw new Error(`profiles vault_user_id lookup failed: ${error.message}`);
    }
    for (const row of data || []) {
      byVaultId.set(String(row.vault_user_id), row.user_id);
    }
  }

  // Layer 3: profiles.email fuzzy match (last-resort).
  const byEmail = new Map();
  const emails = Array.from(emailToStaffIds.keys());
  if (emails.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('email', emails);
    if (error) {
      throw new Error(`profiles email lookup failed: ${error.message}`);
    }
    for (const row of data || []) {
      byEmail.set(String(row.email).toLowerCase(), row.user_id);
    }
  }

  return function matchedUserIdFor(staffId, staffEmail) {
    if (byAlias.has(staffId)) return byAlias.get(staffId);
    if (byVaultId.has(staffId)) return byVaultId.get(staffId);
    if (staffEmail) {
      const k = String(staffEmail).toLowerCase();
      if (byEmail.has(k)) return byEmail.get(k);
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// Upsert + soft-delete
// ---------------------------------------------------------------------------

async function upsertListings(supabase, listingsMap, matchMap) {
  let created = 0;
  let updated = 0;

  // For counting created vs updated, we look at which ids already exist.
  const incomingIds = Array.from(listingsMap.keys());
  let existingIds = new Set();
  if (incomingIds.length > 0) {
    const { data, error } = await supabase
      .from('vault_listings')
      .select('vault_listing_id')
      .in('vault_listing_id', incomingIds);
    if (error) throw new Error(`vault_listings preflight failed: ${error.message}`);
    existingIds = new Set((data || []).map((r) => r.vault_listing_id));
  }

  const listingRows = [];
  const agentRows = [];
  for (const item of listingsMap.values()) {
    listingRows.push(extractListingRow(item));
    for (const a of extractAgentRows(item, matchMap)) {
      agentRows.push(a);
    }
  }

  if (listingRows.length > 0) {
    const { error } = await supabase
      .from('vault_listings')
      .upsert(listingRows, { onConflict: 'vault_listing_id' });
    if (error) throw new Error(`vault_listings upsert failed: ${error.message}`);
    for (const r of listingRows) {
      if (existingIds.has(r.vault_listing_id)) updated++;
      else created++;
    }
  }

  // For agent rows we need to also REMOVE rows that no longer belong (e.g.
  // a co-listing's second agent was removed in Vault). Easiest correct
  // approach at small scale: delete-then-upsert all agent rows for the
  // listings we just synced. Since vault_listing_agents has ON DELETE
  // CASCADE only on vault_listing_id (not on the row level), this is safe.
  if (incomingIds.length > 0) {
    const { error: delErr } = await supabase
      .from('vault_listing_agents')
      .delete()
      .in('vault_listing_id', incomingIds);
    if (delErr) throw new Error(`vault_listing_agents wipe failed: ${delErr.message}`);
  }
  if (agentRows.length > 0) {
    const { error } = await supabase
      .from('vault_listing_agents')
      .upsert(agentRows, { onConflict: 'vault_listing_id,vault_staff_id' });
    if (error) throw new Error(`vault_listing_agents upsert failed: ${error.message}`);
  }

  return { created, updated };
}

/**
 * Soft-delete: anything in vault_listings that wasn't in this pull's response
 * (and isn't already 'withdrawn') gets marked withdrawn. We never DELETE
 * because listings.vault_listing_id may point at the row. Soft-delete keeps
 * the FK valid and lets the UI keep showing the historic context.
 */
async function softDeleteMissing(supabase, listingsMap) {
  const incomingIds = Array.from(listingsMap.keys());

  // Pull the current set of cached active listings (status in the three sync
  // statuses). Anything in this set not in incomingIds is now gone from Vault.
  const { data, error } = await supabase
    .from('vault_listings')
    .select('vault_listing_id')
    .in('status', STATUSES_TO_SYNC);
  if (error) throw new Error(`vault_listings missing-check failed: ${error.message}`);

  const cachedIds = new Set((data || []).map((r) => r.vault_listing_id));
  const toWithdraw = [];
  for (const id of cachedIds) {
    if (!listingsMap.has(id)) toWithdraw.push(id);
  }

  if (toWithdraw.length === 0) return 0;

  const { error: updErr } = await supabase
    .from('vault_listings')
    .update({ status: 'withdrawn', last_synced_at: new Date().toISOString() })
    .in('vault_listing_id', toWithdraw);
  if (updErr) throw new Error(`soft-delete update failed: ${updErr.message}`);

  return toWithdraw.length;
}

// ---------------------------------------------------------------------------
// Sync run bookkeeping
// ---------------------------------------------------------------------------

async function openSyncRun(supabase) {
  const { data, error } = await supabase
    .from('vault_sync_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();
  if (error) {
    // Can't even open a run row — return null and let the caller 500.
    return null;
  }
  return data.id;
}

async function closeSyncRun(supabase, runId, status, counts, errorMessage) {
  await supabase
    .from('vault_sync_runs')
    .update({
      finished_at: new Date().toISOString(),
      listings_pulled: counts.listings_pulled,
      listings_created: counts.listings_created,
      listings_updated: counts.listings_updated,
      listings_removed: counts.listings_removed,
      status,
      error_message: errorMessage,
    })
    .eq('id', runId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip secret values from a string before returning it in an error response
 * or log. Belt-and-braces — none of our error paths above should be passing
 * a secret-bearing string through here, but if one ever does we'd rather
 * scrub it.
 */
function scrubSecrets(env, str) {
  if (!str) return str;
  let out = String(str);
  for (const key of ['VAULTRE_API_KEY', 'VAULTRE_BEARER_TOKEN', 'CRON_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const val = env[key];
    if (val && out.includes(val)) {
      out = out.split(val).join('[redacted]');
    }
  }
  return out;
}
