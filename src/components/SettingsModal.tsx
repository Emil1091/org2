import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatDay } from '../lib/dates'
import { exportJSON, parseImport } from '../lib/exportImport'
import { supabase } from '../lib/supabaseClient'
import { Field, Modal, btnPrimary, btnSecondary, inputCls } from './Modal'

interface BackupRow {
  id: string
  kind: 'live' | 'interval'
  created_at: string
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}

function BackupsSection() {
  const [backups, setBackups] = useState<BackupRow[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('backups')
      .select('id, kind, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setBackups((data as BackupRow[] | null) ?? []))
    supabase
      .from('admins')
      .select('user_id', { count: 'exact', head: true })
      .then(({ count }) => setIsAdmin(!!count))
  }, [])

  const restore = async (b: BackupRow) => {
    const when = b.kind === 'live' ? 'el último guardado' : `el respaldo de ${timeAgo(b.created_at)}`
    if (
      !confirm(
        `¿Reemplazar TODO el plan del equipo con ${when} (${formatDay(b.created_at.slice(0, 10))})? Se guarda un respaldo del estado actual antes de hacerlo.`,
      )
    )
      return
    setRestoringId(b.id)
    const { error } = await supabase.rpc('restore_backup', { p_backup_id: b.id })
    setRestoringId(null)
    if (error) alert(`No se pudo restaurar: ${error.message}`)
    else alert('Restaurado. Puede tardar un segundo en reflejarse en pantalla.')
  }

  if (backups === null) return null

  const live = backups.find((b) => b.kind === 'live')
  const intervals = backups.filter((b) => b.kind === 'interval')

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Respaldos</h3>
      <p className="mb-2 text-xs text-slate-500">
        Uno se guarda con cada cambio, y otro cada 30 minutos (hasta 4).
        {!isAdmin && ' Solo un administrador puede restaurar.'}
      </p>
      <ul className="flex flex-col gap-1 text-xs text-slate-600">
        {live && (
          <li className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5">
            <span>Último guardado — {timeAgo(live.created_at)}</span>
            {isAdmin && (
              <button
                className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50"
                disabled={restoringId !== null}
                onClick={() => void restore(live)}
              >
                {restoringId === live.id ? 'Restaurando…' : 'Restaurar'}
              </button>
            )}
          </li>
        )}
        {intervals.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5"
          >
            <span>Automático — {timeAgo(b.created_at)}</span>
            {isAdmin && (
              <button
                className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50"
                disabled={restoringId !== null}
                onClick={() => void restore(b)}
              >
                {restoringId === b.id ? 'Restaurando…' : 'Restaurar'}
              </button>
            )}
          </li>
        ))}
        {!live && intervals.length === 0 && <li className="text-slate-400">Todavía no hay respaldos.</li>}
      </ul>
    </section>
  )
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const clearData = useStore((s) => s.clearData)
  const loadExample = useStore((s) => s.loadExample)
  const getData = useStore((s) => s.getData)
  const importData = useStore((s) => s.importData)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = parseImport(await file.text())
      if (!confirm('¿Reemplazar todo el plan del equipo con el contenido del archivo?')) return
      importData(data)
      alert('Plan importado correctamente.')
    } catch (err) {
      alert(`No se pudo importar: ${err instanceof Error ? err.message : 'archivo inválido'}`)
    }
  }

  const [newHoliday, setNewHoliday] = useState('')
  const holidays = [...settings.holidays].sort()

  return (
    <Modal
      title="Ajustes"
      onClose={onClose}
      footer={
        <button className={btnSecondary} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="grid gap-6">
        <section>
          <Field label="Color de las barras del cronograma">
            <div className="mt-1 flex flex-col gap-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="colorBy"
                  checked={settings.colorBy === 'priority'}
                  onChange={() => setSettings({ colorBy: 'priority' })}
                />
                Por prioridad (configurable en «Leyenda»)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="colorBy"
                  checked={settings.colorBy === 'status'}
                  onChange={() => setSettings({ colorBy: 'status' })}
                />
                Por estado de la tarea
              </label>
            </div>
          </Field>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Feriados</h3>
          <p className="mb-2 text-xs text-slate-500">
            Se excluyen del cálculo de días laborables y se marcan en el cronograma.
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              className={`${inputCls} max-w-52`}
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
            />
            <button
              className={btnSecondary}
              onClick={() => {
                if (!newHoliday || settings.holidays.includes(newHoliday)) return
                setSettings({ holidays: [...settings.holidays, newHoliday] })
                setNewHoliday('')
              }}
            >
              + Agregar
            </button>
          </div>
          {holidays.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {holidays.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700"
                >
                  {formatDay(h)}
                  <button
                    className="text-rose-400 hover:text-rose-700"
                    onClick={() =>
                      setSettings({ holidays: settings.holidays.filter((x) => x !== h) })
                    }
                    aria-label={`Quitar feriado ${h}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Datos</h3>
          <p className="mb-2 text-xs text-slate-500">
            El plan es compartido por todo el equipo. Exportá una copia en JSON como respaldo;
            importar o borrar reemplaza los datos para todos.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={btnSecondary} onClick={() => exportJSON(getData())}>
              ⬆ Exportar
            </button>
            <button className={btnSecondary} onClick={() => fileRef.current?.click()}>
              ⬇ Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onImportFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              className={btnSecondary}
              onClick={() => {
                if (confirm('¿Reemplazar todo con los datos de ejemplo?')) loadExample()
              }}
            >
              Cargar ejemplo
            </button>
            <button
              className={`${btnPrimary} !bg-rose-600 hover:!bg-rose-500`}
              onClick={() => {
                if (
                  confirm(
                    '¿Borrar TODAS las cuadrillas y tareas? Esta acción no se puede deshacer.',
                  )
                )
                  clearData()
              }}
            >
              Borrar todo
            </button>
          </div>
        </section>

        <BackupsSection />

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Cuenta</h3>
          <p className="mb-2 text-xs text-slate-500">Conectado como {session?.user.email}.</p>
          <button className={btnSecondary} onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </section>
      </div>
    </Modal>
  )
}
