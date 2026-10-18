import { useEffect, useRef } from 'react'
import App from '../App'
import { useAuthStore } from '../store/useAuthStore'
import { useStore } from '../store/useStore'
import { Login } from './Login'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">Cargando…</p>
    </div>
  )
}

export function AuthGate() {
  const authInit = useAuthStore((s) => s.init)
  const authReady = useAuthStore((s) => s.authReady)
  const session = useAuthStore((s) => s.session)

  const storeInit = useStore((s) => s.init)
  const storeReset = useStore((s) => s.reset)
  const storeReady = useStore((s) => s.ready)

  const hadSession = useRef(false)

  useEffect(() => {
    authInit()
  }, [authInit])

  useEffect(() => {
    if (session) {
      hadSession.current = true
      storeInit()
    } else if (hadSession.current) {
      hadSession.current = false
      storeReset()
    }
  }, [session, storeInit, storeReset])

  if (!authReady) return <LoadingScreen />
  if (!session) return <Login />
  if (!storeReady) return <LoadingScreen />
  return <App />
}
