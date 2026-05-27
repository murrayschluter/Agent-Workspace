import { supabase } from './supabase'

// All open tasks, joined with the listing for display.
export async function listOpenCustomTasks() {
  const { data, error } = await supabase
    .from('custom_tasks')
    .select('*, listings(id, address)')
    .is('completed_at', null)
    .order('due_date', { ascending: true })
  if (error) throw error
  return data
}

export async function createCustomTask({ title, due_date, listing_id }) {
  const { data, error } = await supabase
    .from('custom_tasks')
    .insert({
      title,
      due_date,
      listing_id: listing_id || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function completeCustomTask(id) {
  const { error } = await supabase
    .from('custom_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Snooze just shifts the due_date forward. The task stays open.
export async function snoozeCustomTask(id, newDueDate) {
  const { error } = await supabase
    .from('custom_tasks')
    .update({ due_date: newDueDate })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCustomTask(id) {
  const { error } = await supabase.from('custom_tasks').delete().eq('id', id)
  if (error) throw error
}
