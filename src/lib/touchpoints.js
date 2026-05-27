import { supabase } from './supabase'

export async function listTouchpoints(listingId) {
  const { data, error } = await supabase
    .from('touchpoints')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// type: 'monday_report' | 'wednesday_sms' | 'friday_sms'
export async function createTouchpoint(listingId, type, generatedContent) {
  const { data, error } = await supabase
    .from('touchpoints')
    .insert({ listing_id: listingId, type, generated_content: generatedContent })
    .select()
    .single()
  if (error) throw error
  return data
}

// Generic update — used to overwrite generated_content during Regenerate.
export async function updateTouchpoint(id, patch) {
  const { data, error } = await supabase
    .from('touchpoints')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Marking sent also persists whatever edits Murray made to the generated text.
export async function markTouchpointSent(id, finalContent) {
  const { data, error } = await supabase
    .from('touchpoints')
    .update({ sent_at: new Date().toISOString(), generated_content: finalContent })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTouchpoint(id) {
  const { error } = await supabase.from('touchpoints').delete().eq('id', id)
  if (error) throw error
}
