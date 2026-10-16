import { useState } from 'react'
import { useStore } from '../store/useStore'
import { STATUS_META, STATUS_ORDER } from '../types'
import { Modal, btnPrimary, btnSecondary, inputCls } from './Modal'

export function LegendModal({ onClose }: { onClose: () => void }) {
  const priorities = useStore((s) => s.priorities)
  const colorBy = useStore((s) => s.settings.colorBy)
  const updatePriority = useStore((s) => s.updatePriority)
  const addPriority = useStore((s) => s.addPriority)
  const removePriority = useStore((s) => s.removePriority)
  const movePriority = useStore((s) => s.movePriority)

  const sorted = [...priorities].sort((a, b) => a.order - b.order)
  const [newName, setNewName] = useState('')

  return (
    <Modal
      title="Leyenda: prioridades y estados"
      onClose={onClose}
      wide
      footer={
        <button className={btnSecondary} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="grid gap-6">
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            Niveles de prioridad
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            El color de las barras del cronograma y de los chips del listado sale de
            aquí.
            {colorBy === 'priority'
              ? ' Actualmente el cronograma colorea por prioridad.'
              : ' Ojo: el cronograma está configurado para colorear por estado (se cambia en Ajustes).'}
          </p>

          <div className="grid gap-2">
            {sorted.map((p, i) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 sm:flex-nowrap"
              >
                <div className="flex flex-col">
                  <button
                    className="px-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => movePriority(p.id, -1)}
                    title="Subir"
                  >
                    ▲
                  </button>
                  <button
                    className="px-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    disabled={i === sorted.length - 1}
                    onClick={() => movePriority(p.id, 1)}
                    title="Bajar"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="color"
                  className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                  value={p.color}
                  onChange={(e) => updatePriority(p.id, { color: e.target.value })}
                />
                <input
                  className={`${inputCls} max-w-40`}
                  value={p.name}
                  onChange={(e) => updatePriority(p.id, { name: e.target.value })}
                  placeholder="Nombre"
                />
                <input
                  className={inputCls}
                  value={p.description}
                  onChange={(e) => updatePriority(p.id, { description: e.target.value })}
                  placeholder="¿Qué significa este color?"
                />
                <button
                  className="rounded-md px-2 py-1 text-sm text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                  disabled={sorted.length <= 1}
                  onClick={() => {
                    if (confirm(`¿Eliminar la prioridad "${p.name}"?`)) removePriority(p.id)
                  }}
                  title={
                    sorted.length <= 1
                      ? 'Debe quedar al menos una prioridad'
                      : 'Eliminar'
                  }
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className={`${inputCls} max-w-60`}
              placeholder="Nombre de la nueva prioridad"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              className={btnPrimary}
              onClick={() => {
                const name = newName.trim()
                if (!name) return
                addPriority({ name, color: '#64748b', description: '' })
                setNewName('')
              }}
            >
              + Agregar
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Estados</h3>
          <p className="mb-3 text-xs text-slate-500">
            Los estados son fijos (se eligen en cada tarea) y cada uno tiene su color de
            referencia.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {STATUS_ORDER.map((s) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ background: STATUS_META[s].color }}
                />
                <span className="font-medium">{STATUS_META[s].label}</span>
                <span className="text-slate-400">{STATUS_META[s].icon}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}
