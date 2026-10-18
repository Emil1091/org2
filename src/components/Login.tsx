import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { btnPrimary, Field, inputCls } from './Modal'

export function Login() {
  const sendMagicLink = useAuthStore((s) => s.sendMagicLink)
  const error = useAuthStore((s) => s.error)
  const linkSent = useAuthStore((s) => s.linkSent)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || sending) return
    setSending(true)
    await sendMagicLink(email)
    setSending(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h1 className="mb-1 text-lg font-semibold text-slate-800">Planificador de Cuadrillas</h1>
        <p className="mb-5 text-sm text-slate-500">
          Ingresá tu email de trabajo y te mandamos un enlace para entrar.
        </p>

        {linkSent ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            Listo, revisá tu email ({email}) y hacé clic en el enlace para entrar.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <Field label="Email">
              <input
                type="email"
                required
                autoFocus
                className={inputCls}
                placeholder="vos@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" className={btnPrimary} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
