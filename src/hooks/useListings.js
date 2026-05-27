import { useState, useEffect, useCallback } from 'react'
import { listListingsWithRelations } from '../lib/listings'
import { isSupabaseConfigured } from '../lib/supabase'

export function useListings() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(new Error(
        'Supabase env vars are missing. Copy .env.example to .env, fill in your Supabase URL + publishable key, then restart the dev server (Ctrl+C in the terminal, then npm run dev).'
      ))
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await listListingsWithRelations()
      setListings(data ?? [])
      setError(null)
    } catch (e) {
      setError(e)
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { listings, loading, error, refetch }
}
