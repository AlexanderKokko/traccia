import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True once the project credentials are present. Without them the app falls
 * back to the device-local store, so it still runs — but nothing syncs and
 * there are no accounts. See README.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // The session lives in localStorage and is refreshed in the background,
        // so reopening the app on any device resumes without a new sign-in.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
