import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  STATUS_META,
  STATUS_ORDER,
  type Group,
  type PriorityLevel,
  type Task,
  type TaskStatus,
} from '../types'
import { exportTasksCSV } from '../lib/exportImport'
import { btnPrimary, btnSecondary, inputCls } from './Modal'

type SortKey = 'title' | 'groups' | 'status' | 'priority' | 'progress'

const UNASSIGNED_VALUE = '__unassigned__'
const MULTI_VALUE = '__multi__'

const selectCls =
  'cursor-pointer rounded-full border-0 py-0.5 pr-6 pl-2 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'

function StatusSelect({ value, onChange }: { value: TaskStatus; onChange: (v: TaskStatus) => void }) {
  const status = STATUS_META[value]
  return (
    <select
      className={selectCls}
      style={{ background: `${status.color}22`, color: status.color }}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      title="Cambiar estado"
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].icon} {STATUS_META[s].label}
        </option>
      ))}
    </select>
  )
}

function PrioritySelect({
  value,
  priorities,
  onChange,
}: {
  value: string
  priorities: PriorityLevel[]
  onChange: (v: string) => void
}) {
  const current = priorities.find((p) => p.id === value) ?? priorities[0]
  return (
    <select
      className={selectCls}
      style={{ background: `${current?.color}22`, color: current?.color }}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      title="Cambiar prioridad"
    >
      {priorities.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

function GroupSelect({
  groupIds,
  groups,
  onChange,
}: {
  groupIds: string[]
  groups: Group[]
  onChange: (groupIds: string[]) => void
}) {
  const current =
    groupIds.length === 0 ? UNASSIGNED_VALUE : groupIds.length === 1 ? groupIds[0] : MULTI_VALUE
  const selected = groups.find((g) => g.id === current)
  const color = selected?.color ?? '#64748b'
  return (
    <select
      className={selectCls}
      style={{ background: `${color}22`, color }}
      value={current}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value === UNASSIGNED_VALUE ? [] : [e.target.value])}
      title="Cambiar cuadrilla"
    >
      {groupIds.length > 1 && (
        <option value={MULTI_VALUE} disabled>
          Varias cuadrillas
        </option>
      )}
      <option value={UNASSIGNED_VALUE}>Sin asignar</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  )
}

interface Props {
  onOpenTask: (id: string) => void
  onNewTask: () => void
  onHoverTask?: (id: string | null) => void
  panelCollapsed: boolean
  onTogglePanelCollapsed: () => void
  /** Lista angosta (disposición lado a lado): solo título + cuadrilla + estado + prioridad. */
  compact?: boolean
}

export function TaskList({
  onOpenTask,
  onNewTask,
  onHoverTask,
  panelCollapsed,
  onTogglePanelCollapsed,
  compact = false,
}: Props) {
  const tasks = useStore((s) => s.tasks)
  const groups = useStore((s) => s.groups)
  const priorities = useStore((s) => s.priorities)
  const holidays = useStore((s) => s.settings.holidays)
  const updateTask = useStore((s) => s.updateTask)

  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [dir, setDir] = useState<1 | -1>(1)
  const [query, setQuery] = useState('')

  const gmap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const pmap = useMemo(() => new Map(priorities.map((p) => [p.id, p])), [priorities])
  const sortedPriorities = useMemo(
    () => [...priorities].sort((a, b) => a.order - b.order),
    [priorities],
  )
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t) => {
      const groupNames = t.groupIds.map((id) => gmap.get(id)?.name ?? '').join(' ')
      return `${t.title} ${t.description} ${groupNames}`.toLowerCase().includes(q)
    })
  }, [tasks, query, gmap])

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
        case 'status':
          return STATUS_ORDER.indexOf(t.status)
        case 'priority':
          return pmap.get(t.priorityId)?.order ?? 99
        case 'progress':
          return t.progress
      }
    }
    return [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return a.start.localeCompare(b.start)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, dir, gmap, pmap])

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

  const emptyState =
    tasks.length === 0 ? (
      <p className="p-6 text-center text-sm text-slate-500">
        No hay tareas todavía. Usá «Nueva tarea» para cargar la primera.
      </p>
    ) : sorted.length === 0 ? (
      <p className="p-6 text-center text-sm text-slate-500">Ninguna tarea coincide con «{query}».</p>
    ) : null

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 px-3 py-2">
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
          Tareas ({query ? `${sorted.length} de ${tasks.length}` : tasks.length})
        </h2>
        {!panelCollapsed && (
          <input
            type="search"
            className={`${inputCls} ${compact ? 'w-full' : 'max-w-56'}`}
            placeholder="Buscar tarea…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {!panelCollapsed && (
          <div className={compact ? 'flex w-full gap-2' : 'ml-auto flex gap-2'}>
            {!compact && (
              <button
                className={btnSecondary}
                onClick={() => exportTasksCSV(sorted, groups, priorities, holidays)}
                disabled={tasks.length === 0}
                title="Descargar las tareas como CSV (Excel)"
              >
                ⬇ CSV
              </button>
            )}
            <button className={`${btnPrimary} ${compact ? 'flex-1' : ''}`} onClick={onNewTask}>
              ＋ Nueva tarea
            </button>
          </div>
        )}
      </div>

      {panelCollapsed ? null : compact ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {emptyState ?? (
            <ul className="divide-y divide-slate-100">
              {sorted.map((t) => (
                <li
                  key={t.id}
                  className="flex cursor-pointer flex-col gap-1 px-3 py-2 hover:bg-slate-50"
                  onClick={() => onOpenTask(t.id)}
                  onMouseEnter={() => onHoverTask?.(t.id)}
                  onMouseLeave={() => onHoverTask?.(null)}
                >
                  <span className="truncate text-sm font-medium text-slate-800" title={t.title}>
                    {t.title}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <GroupSelect
                      groupIds={t.groupIds}
                      groups={sortedGroups}
                      onChange={(groupIds) => updateTask(t.id, { groupIds })}
                    />
                    <StatusSelect
                      value={t.status}
                      onChange={(status) => updateTask(t.id, { status })}
                    />
                    <PrioritySelect
                      value={t.priorityId}
                      priorities={sortedPriorities}
                      onChange={(priorityId) => updateTask(t.id, { priorityId })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {emptyState ?? (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {header('title', 'Título', 'w-full')}
                  {header('groups', 'Cuadrilla')}
                  {header('status', 'Estado')}
                  {header('priority', 'Prioridad')}
                  {header('progress', 'Progreso')}
                  <th className="px-3 py-2 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => onOpenTask(t.id)}
                    onMouseEnter={() => onHoverTask?.(t.id)}
                    onMouseLeave={() => onHoverTask?.(null)}
                  >
                    <td className="max-w-xl px-3 py-2">
                      <div className="truncate font-medium text-slate-800" title={t.title}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="truncate text-xs text-slate-400" title={t.description}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <GroupSelect
                        groupIds={t.groupIds}
                        groups={sortedGroups}
                        onChange={(groupIds) => updateTask(t.id, { groupIds })}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect
                        value={t.status}
                        onChange={(status) => updateTask(t.id, { status })}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <PrioritySelect
                        value={t.priorityId}
                        priorities={sortedPriorities}
                        onChange={(priorityId) => updateTask(t.id, { priorityId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-slate-500"
                            style={{ width: `${t.progress}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-500">{t.progress}%</span>
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
