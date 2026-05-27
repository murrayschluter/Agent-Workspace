import { supabase } from './supabase'
import { getActiveContract, markContractFellOver } from './contracts'

export async function listListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Dashboard query.
export async function listListingsWithRelations() {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      contracts(*),
      touchpoints(id, type, sent_at, created_at),
      weekly_logs(week_ending, enquiry_count),
      listing_services(service_type)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getListing(id) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// Detail page query.
export async function getListingFull(id) {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      contracts(*),
      weekly_logs(*),
      touchpoints(*),
      stage_history(*),
      documents(*),
      listing_services(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createListing(input) {
  const { data, error } = await supabase
    .from('listings')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateListing(id, patch) {
  const { data, error } = await supabase
    .from('listings')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateListingStage(id, newStage) {
  return updateListing(id, { stage: newStage })
}

export async function markListingFellOver(listingId) {
  const active = await getActiveContract(listingId)
  if (active) await markContractFellOver(active.id)
  return updateListingStage(listingId, 'launched_online')
}

// Delete listing + cascade-cleanup storage files.
// DB cascades handle contracts/weekly_logs/touchpoints/stage_history/documents
// rows. Storage objects need to be cleaned up separately (best effort).
export async function deleteListing(id) {
  const { data: docs } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('listing_id', id)

  if (docs?.length) {
    const paths = docs.map((d) => d.storage_path)
    await supabase.storage
      .from('listing-documents')
      .remove(paths)
      .catch((e) => console.warn('Storage cleanup failed:', e))
  }

  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) throw error
}
