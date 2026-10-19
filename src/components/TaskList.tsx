import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { STATUS_META, STATUS_ORDER, type Task, type TaskStatus } from '../types'
import { formatDay, workdayCount } from '../lib/dates'
import { exportTasksCSV } from '../lib/exportImport'
import { btnPrimary, btnSecondary } from './Modal'

type SortKey =
  | 'title'
  | 'groups'
  | 'start'
  | 'end'
  | 'duration'
  | 'status'
  | 'priority'
  | 'progress'

interface Props {
  onOpenTask: (id: string) => void
  onNewTask: () => void
  onHoverTask?: (id: string | null) => void
  panelCollapsed: boolean
  onTogglePanelCollapsed: () => void
}

export function TaskList({
  onOpenTask,
  onNewTask,
  onHoverTask,
  panelCollapsed,
  onTogglePanelCollapsed,
}: Props) {
  const tasks = useStore((s) => s.tasks)
  const groups = useStore((s) => s.groups)
  const priorities = useStore((s) => s.priorities)
  const holidays = useStore((s) => s.settings.holidays)
  const updateTask = useStore((s) => s.updateTask)

  const [sortKey, setSortKey] = useState<SortKey>('start')
  const [dir, setDir] = useState<1 | -1>(1)

  const gmap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const pmap = useMemo(() => new Map(priorities.map((p) => [p.id, p])), [priorities])
  const hset = useMemo(() => new Set(holidays), [holidays])
  const sortedPriorities = useMemo(
    () => [...priorities].sort((a, b) => a.order - b.order),
    [priorities],
  )

  const satWorks = (t: Task) =>
    t.groupIds.length === 0
      ? true
      : t.groupIds.some((id) => gmap.get(id)?.worksSaturday)

  const duration = (t: Task) =>
    workdayCount(t.start, t.end, satWorks(t), new Set([...hset, ...(t.offDays ?? [])]))

  const sorted = useMemo(() => {
    const val = (t: Task): string | number => {
      switch (sortKey) {
        case 'title':
          return t.title.toLowerCase()
        case 'groups':
          return t.groupIds
            .map((id) => gmap.get(id)?.name ?? '')
            .join(',')
            .toLowerCase()
        case 'start':
          return t.start
        case 'end':
          return t.end
        case 'duration':
          return duration(t)
        case 'status':
          return STATUS_ORDER.indexOf(t.status)
        case 'priority':
          return pmap.get(t.priorityId)?.order ?? 99
        case 'progress':
          return t.progress
      }
    }
    return [...tasks].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return a.start.localeCompare(b.start)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sortKey, dir, gmap, pmap, hset])

  const header = (key: SortKey, label: string, cls = '') => (
    <th
      className={`cursor-pointer px-3 py-2 text-left font-semibold whitespace-nowrap select-none hover:text-slate-900 ${cls}`}
      onClick={() => {
        if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1))
        else {
          setSortKey(key)
          setDir(1)
        }
      }}
      title="Clic para ordenar"
    >
      {label}
      {sortKey === key && <span className="ml-1 text-slate-400">{dir === 1 ? '▲' : '▼'}</span>}
    </th>
  )

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          className="text-sm leading-none text-slate-500 hover:text-slate-800"
          onClick={onTogglePanelCollapsed}
          title={panelCollapsed ? 'Expandir lista de tareas' : 'Colapsar lista de tareas'}
          aria-label={panelCollapsed ? 'Expandir lista de tareas' : 'Colapsar lista de tareas'}
          aria-expanded={!panelCollapsed}
        >
          {panelCollapsed ? '▸' : '▾'}
        </button>
        <h2 className="text-sm font-semibold text-slate-800">
          Tareas ({tasks.length})
        </h2>
        {!panelCollapsed && (
          <span className="hidden text-xs text-slate-400 sm:inline">
            clic en una fila para editar
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            className={btnSecondary}
            onClick={() => exportTasksCSV(sorted, groups, priorities, holidays)}
            disabled={tasks.length === 0}
            title="Descargar las tareas como CSV (Excel)"
          >
            ⬇ CSV
          </button>
          <button className={btnPrimary} onClick={onNewTask}>
            ＋ Nueva tarea
          </button>
        </div>
      </div>

      {panelCollapsed ? null : (
      <div className="min-h-0 flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No hay tareas todavía. Usá «Nueva tarea» para cargar la primera.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
              <tr>
                {header('title', 'Título')}
                {header('groups', 'Cuadrillas')}
                {header('start', 'Inicio')}
                {header('end', 'Fin')}
                {header('duration', 'Días lab.')}
                {header('status', 'Estado')}
                {header('priority', 'Prioridad')}
                {header('progress', 'Progreso')}
                <th className="px-3 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const status = STATUS_META[t.status]
                const prio = pmap.get(t.priorityId)
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => onOpenTask(t.id)}
                    onMouseEnter={() => onHoverTask?.(t.id)}
                    onMouseLeave={() => onHoverTask?.(null)}
                  >
                    <td className="max-w-72 px-3 py-2">
                      <div className="truncate font-medium text-slate-800" title={t.title}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="truncate text-xs text-slate-400" title={t.description}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {t.groupIds.length === 0 ? (
                          <span className="text-xs text-slate-400">sin asignar</span>
                        ) : (
                          t.groupIds.map((id) => {
                            const g = gmap.get(id)
                            if (!g) return null
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap"
                                style={{ background: `${g.color}22`, color: g.color }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: g.color }}
                                />
                                {g.name}
                              </span>
                            )
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDay(t.start)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDay(t.end)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{duration(t)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="cursor-pointer rounded-full border-0 py-0.5 pr-6 pl-2 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        style={{ background: `${status.color}22`, color: status.color }}
                        value={t.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTask(t.id, { status: e.target.value as TaskStatus })}
                        title="Cambiar estado"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_META[s].icon} {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="cursor-pointer rounded-full border-0 py-0.5 pr-6 pl-2 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        style={{ background: `${(prio ?? sortedPriorities[0])?.color}22`, color: (prio ?? sortedPriorities[0])?.color }}
                        value={t.priorityId}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTask(t.id, { priorityId: e.target.value })}
                        title="Cambiar prioridad"
                      >
                        {sortedPriorities.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-slate-500"
                            style={{ width: `${t.progress}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-500">
                          {t.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenTask(t.id)
                        }}
                        title="Editar"
                      >
                        ✏ Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </section>
  )
}
