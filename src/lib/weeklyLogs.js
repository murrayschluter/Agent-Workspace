import { supabase } from './supabase'

export async function listWeeklyLogs(listingId) {
  const { data, error } = await supabase
    .from('weekly_logs')
    .select('*')
    .eq('listing_id', listingId)
    .order('week_ending', { ascending: false })
  if (error) throw error
  return data
}

// Most recent log for a listing — feeds AI touchpoint generation prompts.
export async function getLatestWeeklyLog(listingId) {
  const { data, error } = await supabase
    .from('weekly_logs')
    .select('*')
    .eq('listing_id', listingId)
    .order('week_ending', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createWeeklyLog(listingId, input) {
  const { data, error } = await supabase
    .from('weekly_logs')
    .insert({ ...input, listing_id: listingId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWeeklyLog(id, patch) {
  const { data, error } = await supabase
    .from('weekly_logs')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWeeklyLog(id) {
  const { error } = await supabase.from('weekly_logs').delete().eq('id', id)
  if (error) throw error
}
