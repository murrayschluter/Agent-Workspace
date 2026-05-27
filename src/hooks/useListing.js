import { useState, useEffect, useCallback } from 'react'
import { getListingFull } from '../lib/listings'
import { isSupabaseConfigured } from '../lib/supabase'

export function useListing(id) {
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(new Error('Supabase env vars missing. Check .env and restart the dev server.'))
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await getListingFull(id)
      setListing(data)
      setError(null)
    } catch (e) {
      setError(e)
      setListing(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { listing, loading, error, refetch }
}
