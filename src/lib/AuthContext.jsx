import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/api/supabaseClient'
import { subscribeToChanges } from '@/api/supabaseData'
import { db } from '@/api/client'

const AuthContext = createContext({
  user: null,
  profile: null,
  isLoading: true,
  requiresAuth: false,
  refreshProfile: () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // A promise chain rather than async/await: nothing here runs synchronously, so
  // an effect can call it without kicking off a cascading render.
  const refreshProfile = useCallback(
    () =>
      db.auth
        .me()
        .then(setProfile)
        .catch(() => setProfile(null)),
    []
  )

  useEffect(() => {
    // With no project configured the app runs against the device-local store,
    // where there is a single implicit user and nothing to sign in to.
    if (!isSupabaseConfigured) {
      db.auth
        .me()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setIsLoading(false))
      return
    }

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Drop the cached profile the moment the session ends, so a signed-out
      // device cannot briefly show the previous patient's name.
      if (!session) setProfile(null)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // Load the profile, and keep every signed-in device in step, for as long as
  // this user is signed in.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    refreshProfile()
    return subscribeToChanges(user.id)
  }, [user, refreshProfile])

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      requiresAuth: isSupabaseConfigured,
      isAuthenticated: isSupabaseConfigured ? Boolean(user) : true,
      refreshProfile,
    }),
    [user, profile, isLoading, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The provider and its hook belong together; Fast Refresh's one-export-per-file
// rule does not apply to a context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
