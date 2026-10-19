import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { btnPrimary, Field, inputCls } from './Modal'

export function Login() {
  const signIn = useAuthStore((s) => s.signIn)
  const error = useAuthStore((s) => s.error)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password || sending) return
    setSending(true)
    await signIn(email, password)
    setSending(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h1 className="mb-1 text-lg font-semibold text-slate-800">Planificador de Proyectos</h1>
        <p className="mb-5 text-sm text-slate-500">Ingresá con tu usuario y contraseña.</p>

        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Email">
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              className={inputCls}
              placeholder="vos@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              required
              autoComplete="current-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className={btnPrimary} disabled={sending}>
            {sending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
