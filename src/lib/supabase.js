import { createClient } from '@supabase/supabase-js'

// Lazy/lenient init: app loads even if env is missing.
// Calls will surface a clear error in the UI instead of crashing on import.
const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url || 'http://invalid', key || 'invalid')
export const isSupabaseConfigured = Boolean(url && key)
