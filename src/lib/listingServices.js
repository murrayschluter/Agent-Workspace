import { supabase } from './supabase'

export const SERVICE_LABELS = {
  photographer: 'Photographer',
  signboard: 'Signboard',
  conveyancer: 'Conveyancer',
  building_inspector: 'Building Inspector',
  marketing: 'Marketing',
  other: 'Other',
}

// Emoji icons — cheap, no icon library required.
export const SERVICE_ICONS = {
  photographer: '📷',
  signboard: '🪧',
  conveyancer: '📋',
  building_inspector: '🔍',
  marketing: '📣',
  other: '📎',
}

export async function listServices(listingId) {
  const { data, error } = await supabase
    .from('listing_services')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createService(listingId, input) {
  const { data, error } = await supabase
    .from('listing_services')
    .insert({ ...input, listing_id: listingId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateService(id, patch) {
  const { data, error } = await supabase
    .from('listing_services')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteService(id) {
  const { error } = await supabase.from('listing_services').delete().eq('id', id)
  if (error) throw error
}
