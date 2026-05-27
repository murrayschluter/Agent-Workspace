import { supabase } from './supabase'

// Currently-live contract for a listing, or null.
export async function getActiveContract(listingId) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('listing_id', listingId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

// All contracts including fallen-over history. Newest first.
export async function listContracts(listingId) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Insert a new active contract. Deactivates any prior active one first —
// the partial unique index `contracts_one_active` forbids two simultaneous actives.
export async function createContract(listingId, input) {
  await supabase
    .from('contracts')
    .update({ is_active: false, fell_over_at: new Date().toISOString() })
    .eq('listing_id', listingId)
    .eq('is_active', true)

  const { data, error } = await supabase
    .from('contracts')
    .insert({ ...input, listing_id: listingId, is_active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

// conditions is a jsonb array of { type, label?, due_date, cleared_at? }.
export async function updateContractConditions(id, conditions) {
  const { data, error } = await supabase
    .from('contracts')
    .update({ conditions })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContract(id, patch) {
  const { data, error } = await supabase
    .from('contracts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markContractFellOver(id) {
  const { data, error } = await supabase
    .from('contracts')
    .update({ is_active: false, fell_over_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
