import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

interface AuthStore {
  session: Session | null
  authReady: boolean
  error: string | null
  linkSent: boolean
  init: () => void
  sendMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set) => ({
  session: null,
  authReady: false,
  error: null,
  linkSent: false,

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

  sendMagicLink: async (email) => {
    set({ error: null, linkSent: false })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      set({ error: error.message })
    } else {
      set({ linkSent: true })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },
}))
