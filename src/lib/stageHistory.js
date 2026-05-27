import { supabase } from './supabase'

// Chronological — oldest first, for timeline display on listing detail page.
// Rows are written automatically by the listings_record_stage_history trigger.
export async function listStageHistory(listingId) {
  const { data, error } = await supabase
    .from('stage_history')
    .select('*')
    .eq('listing_id', listingId)
    .order('changed_at', { ascending: true })
  if (error) throw error
  return data
}
