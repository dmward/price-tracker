import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import { browserAPI } from './browserAPI'
import type { StoredSession } from './storage'
import { AUTH_KEY } from './storage'

// These are injected at build time via environment variables.
// Create a .env file at the project root:
//   VITE_SUPABASE_URL=https://yourproject.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[price-tracker] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// Custom storage adapter that persists the Supabase session in chrome.storage.local
// instead of localStorage (which is not shared across extension contexts).
const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      browserAPI.storage.local.get(key, (result) => {
        const val = result[key]
        resolve(typeof val === 'string' ? val : null)
      })
    })
  },
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      browserAPI.storage.local.set({ [key]: value }, resolve)
    })
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      browserAPI.storage.local.remove(key, resolve)
    })
  },
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Re-hydrate the session in the service worker on startup.
// Must be called at the top of background/index.ts before any auth-gated calls.
export async function rehydrateSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  // Fallback: read the legacy stored session format
  const stored: StoredSession | null = await new Promise<StoredSession | null>((resolve) => {
    browserAPI.storage.local.get(AUTH_KEY, (result) => {
      resolve((result[AUTH_KEY] as StoredSession) ?? null)
    })
  })

  if (stored?.accessToken) {
    const { data: refreshed } = await supabase.auth.setSession({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken,
    })
    return refreshed.session
  }

  return null
}

// Persist session tokens whenever auth state changes.
// Call this once in both the background service worker and popup.
export function setupAuthPersistence(): void {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      const toStore: StoredSession = {
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? '',
        expiresAt: session.expires_at ?? 0,
      }
      browserAPI.storage.local.set({ [AUTH_KEY]: toStore })
    } else {
      browserAPI.storage.local.remove(AUTH_KEY)
    }
  })
}
