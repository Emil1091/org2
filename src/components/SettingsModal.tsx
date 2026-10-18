import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useAuthStore } from '../store/useAuthStore'
import { formatDay } from '../lib/dates'
import { Field, Modal, btnPrimary, btnSecondary, inputCls } from './Modal'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const clearData = useStore((s) => s.clearData)
  const loadExample = useStore((s) => s.loadExample)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)

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
            Los datos se guardan en este navegador. Usá «Exportar» de la barra superior
            para compartir el plan (JSON).
          </p>
          <div className="flex flex-wrap gap-2">
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
