import { supabase } from './supabase'

// Phase V5 — Vault picker data layer.
//
// The Vault sync (api/sync-vault-listings.js) populates the vault_listings
// cache. This module lets a user browse those synced VaultRE properties and
// turn the ones they choose into tracked listings (rows in `listings`, linked
// back via listings.vault_listing_id).

const CAMPAIGN_TYPES = new Set(['private_treaty', 'auction', 'eoi'])

// Pull synced Vault listings and flag which are already tracked.
// "Tracked" is judged against the listings the current user can see under RLS.
export async function listVaultListings() {
  const { data: vault, error } = await supabase
    .from('vault_listings')
    .select(
      'vault_listing_id, address, suburb, state, postcode, status, campaign_type, list_price_display, list_date, vault_url, last_synced_at'
    )
    .order('list_date', { ascending: false, nullsFirst: false })
  if (error) throw error

  const { data: tracked, error: tErr } = await supabase
    .from('listings')
    .select('vault_listing_id')
    .not('vault_listing_id', 'is', null)
  if (tErr) throw tErr

  const trackedSet = new Set((tracked || []).map((r) => r.vault_listing_id))
  return (vault || []).map((v) => ({ ...v, tracked: trackedSet.has(v.vault_listing_id) }))
}

// Create tracked listings from the chosen Vault listings. Already-tracked rows
// are skipped. owner_id and created_by are stamped by the BEFORE INSERT trigger
// (set_listing_owner_on_insert), so the creator becomes the owner.
export async function addVaultListingsAsTracked(vaultListings) {
  const rows = (vaultListings || [])
    .filter((v) => !v.tracked)
    .map((v) => {
      const row = { address: v.address, vault_listing_id: v.vault_listing_id }
      if (v.list_date) row.list_date = v.list_date
      if (CAMPAIGN_TYPES.has(v.campaign_type)) row.campaign_type = v.campaign_type
      return row
    })

  if (rows.length === 0) return { added: 0 }

  const { data, error } = await supabase.from('listings').insert(rows).select('id')
  if (error) throw error
  return { added: data?.length ?? 0 }
}
