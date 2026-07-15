import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const PROFILE_FIELDS = 'user_id, email, display_name, role, vault_user_id'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  const loadProfile = useCallback(async (nextSession) => {
    const currentRequest = ++requestId.current
    setError(null)

    if (!nextSession) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('user_id', nextSession.user.id)
      .maybeSingle()

    if (currentRequest !== requestId.current) return
    if (profileError) {
      setProfile(null)
      setError(profileError)
    } else {
      setProfile(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) {
        setError(sessionError)
        setLoading(false)
        return
      }
      const nextSession = data.session ?? null
      setSession(nextSession)
      loadProfile(nextSession)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      loadProfile(nextSession)
    })

    return () => {
      active = false
      requestId.current += 1
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const retryProfile = useCallback(() => loadProfile(session), [loadProfile, session])

  return (
    <AuthContext.Provider value={{ session, profile, loading, error, retryProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
