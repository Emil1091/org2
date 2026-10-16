import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { computeAlerts, type AlertKind, type TaskAlert } from '../lib/alerts'
import { todayISO } from '../lib/dates'
import { Modal, btnSecondary } from './Modal'

interface Props {
  onOpenTask: (id: string) => void
  onClose: () => void
}

const KIND_META: Record<AlertKind, { title: string; hint: (days: number) => string }> = {
  not_started: {
    title: 'Sin iniciar a tiempo',
    hint: (d) => `Debería haber empezado hace ${d} día${d === 1 ? '' : 's'}`,
  },
  overdue: {
    title: 'Vencidas',
    hint: (d) => `Se pasó la fecha de fin hace ${d} día${d === 1 ? '' : 's'}`,
  },
  long_duration: {
    title: 'Planificación larga',
    hint: (d) => `${d} días laborables planificados`,
  },
  dependency_conflict: {
    title: 'Conflicto de dependencia',
    hint: () => 'Empieza antes de que termine otra de la que depende',
  },
}

export function AlertsPanel({ onOpenTask, onClose }: Props) {
  const tasks = useStore((s) => s.tasks)
  const groups = useStore((s) => s.groups)
  const holidays = useStore((s) => s.settings.holidays)
  const updateTask = useStore((s) => s.updateTask)

  const alerts = useMemo(
    () => computeAlerts(tasks, groups, new Set(holidays), todayISO()),
    [tasks, groups, holidays],
  )
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const byKind = useMemo(() => {
    const map = new Map<AlertKind, TaskAlert[]>()
    for (const a of alerts) {
      const list = map.get(a.kind) ?? []
      list.push(a)
      map.set(a.kind, list)
    }
    return map
  }, [alerts])

  return (
    <Modal
      title="Alertas"
      onClose={onClose}
      footer={
        <button className={btnSecondary} onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {alerts.length === 0 ? (
        <p className="text-sm text-slate-500">No hay alertas activas. Todo en orden.</p>
      ) : (
        <div className="grid gap-5">
          {(
            ['overdue', 'not_started', 'dependency_conflict', 'long_duration'] as AlertKind[]
          ).map((kind) => {
            const list = byKind.get(kind)
            if (!list || list.length === 0) return null
            const meta = KIND_META[kind]
            return (
              <section key={kind}>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">
                  {meta.title} ({list.length})
                </h3>
                <div className="grid gap-1.5">
                  {list.map((a) => {
                    const t = taskById.get(a.taskId)
                    if (!t) return null
                    return (
                      <div
                        key={`${kind}-${a.taskId}`}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <button
                          className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:underline"
                          onClick={() => {
                            onOpenTask(t.id)
                            onClose()
                          }}
                        >
                          {t.title}
                        </button>
                        <span className="shrink-0 text-xs text-slate-500">
                          {meta.hint(a.days)}
                        </span>
                        {kind === 'overdue' && (
                          <span className="flex shrink-0 gap-1.5">
                            <button
                              className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              onClick={() => updateTask(t.id, { status: 'completada', progress: 100 })}
                              title="Marcar la tarea como completada"
                            >
                              ✓ Completar
                            </button>
                            <button
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              onClick={() => {
                                onOpenTask(t.id)
                                onClose()
                              }}
                              title="Abrir la tarea para ampliar el plazo"
                            >
                              📅 Extender
                            </button>
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
