import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

interface AuthStore {
  session: Session | null
  authReady: boolean
  error: string | null
  init: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set) => ({
  session: null,
  authReady: false,
  error: null,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, authReady: true })
      if (data.session) void supabase.realtime.setAuth(data.session.access_token)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, authReady: true })
      if (session) void supabase.realtime.setAuth(session.access_token)
    })
  },

  signIn: async (email, password) => {
    set({ error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({
        error:
          error.message === 'Invalid login credentials'
            ? 'Email o contraseña incorrectos.'
            : error.message,
      })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },
}))
