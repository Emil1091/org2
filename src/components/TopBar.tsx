import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { computeAlerts } from '../lib/alerts'
import { todayISO } from '../lib/dates'
import { btnPrimary, btnSecondary } from './Modal'

interface Props {
  onNewTask: () => void
  onNewGroup: () => void
  onOpenLegend: () => void
  onOpenSettings: () => void
  onOpenAlerts: () => void
}

export function TopBar({
  onNewTask,
  onNewGroup,
  onOpenLegend,
  onOpenSettings,
  onOpenAlerts,
}: Props) {
  const tasks = useStore((s) => s.tasks)
  const groups = useStore((s) => s.groups)
  const holidays = useStore((s) => s.settings.holidays)

  const alertCount = useMemo(
    () => computeAlerts(tasks, groups, new Set(holidays), todayISO()).length,
    [tasks, groups, holidays],
  )

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="mr-auto flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm text-white">
          🗓
        </span>
        <div className="leading-tight">
          <h1 className="text-sm font-bold text-slate-800">
            Planificador de Cuadrillas
          </h1>
          <p className="text-[11px] text-slate-500">
            Cronograma de tareas por grupo de trabajo
          </p>
        </div>
      </div>

      <button
        className={`${btnSecondary} relative`}
        onClick={onOpenAlerts}
        title="Tareas vencidas, sin iniciar o de larga duración"
      >
        ⚠ Alertas
        {alertCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {alertCount}
          </span>
        )}
      </button>
      <button className={btnSecondary} onClick={onOpenLegend} title="Prioridades y estados">
        🎨 Leyenda
      </button>
      <button className={btnSecondary} onClick={onOpenSettings} title="Ajustes">
        ⚙ Ajustes
      </button>
      <button className={btnSecondary} onClick={onNewGroup}>
        + Cuadrilla
      </button>
      <button className={btnPrimary} onClick={onNewTask}>
        ＋ Nueva tarea
      </button>
    </header>
  )
}
