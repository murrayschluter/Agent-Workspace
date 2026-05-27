import { useState, useEffect, useCallback } from 'react'
import { listOpenCustomTasks } from '../lib/customTasks'
import { isSupabaseConfigured } from '../lib/supabase'

export function useCustomTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await listOpenCustomTasks()
      setTasks(data ?? [])
      setError(null)
    } catch (e) {
      setError(e)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { tasks, loading, error, refetch }
}
