import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { getISOWeek } from 'date-fns'
import { useStore } from '../store/useStore'
import { STATUS_META, type Task } from '../types'
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  addDaysISO,
  addMonthsISO,
  daysInMonthISO,
  diffDays,
  eachDayISO,
  formatDay,
  isSaturday,
  isSunday,
  monthStartISO,
  parseDay,
  todayISO,
  weekStartISO,
  weekday,
  workdayCount,
} from '../lib/dates'
import { contrastText } from '../lib/colors'
import { directDependents, hasDependencyConflict } from '../lib/dependencies'
import { btnPrimary } from './Modal'

type Zoom = 'day' | 'week' | 'month'
type Preset = 'week' | 'weeks3' | 'month'

const DAY_WIDTH: Record<Zoom, number> = { day: 44, week: 20, month: 8 }
const LEFT_W = 232
const ROW_PAD = 8
const LANE_H = 32
const BAR_H = 24
const UNASSIGNED_ID = '__unassigned__'
const COLLAPSED_KEY = 'gantt-collapsed-rows'

function readCollapsed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

interface Segment {
  key: string
  label: string
  sub?: string
  days: number
  weekend?: boolean
  isToday?: boolean
  isHoliday?: boolean
  title?: string
}

interface PlacedBar {
  task: Task
  lane: number
  startIdx: number
  endIdx: number
}

type DragMode = 'move' | 'resize-l' | 'resize-r'

interface DragState {
  taskId: string
  mode: DragMode
  fromRowId: string
  startX: number
  startY: number
  origStart: string
  origEnd: string
  delta: number
  moved: boolean
  clientX: number
  clientY: number
  hoverRowId?: string
}

/** Id de la fila (cuadrilla o "Pendientes") cuyo rect contiene `clientY`. */
function findRowAt(rowEls: Map<string, HTMLDivElement>, clientY: number): string | undefined {
  for (const [id, el] of rowEls) {
    const r = el.getBoundingClientRect()
    if (clientY >= r.top && clientY <= r.bottom) return id
  }
  return undefined
}

/** Nuevo `groupIds` al mover una tarea de la fila `from` a la fila `to`. */
function reassignRow(groupIds: string[], from: string, to: string): string[] {
  if (from === to) return groupIds
  const withoutFrom = from === UNASSIGNED_ID ? groupIds : groupIds.filter((id) => id !== from)
  if (to === UNASSIGNED_ID) return withoutFrom
  return withoutFrom.includes(to) ? withoutFrom : [...withoutFrom, to]
}

/** Fechas resultantes de arrastrar `delta` días según el modo. */
function applyDelta(
  d: Pick<DragState, 'mode' | 'origStart' | 'origEnd'>,
  delta: number,
): { start: string; end: string } {
  if (d.mode === 'move') {
    return {
      start: addDaysISO(d.origStart, delta),
      end: addDaysISO(d.origEnd, delta),
    }
  }
  if (d.mode === 'resize-l') {
    const start = addDaysISO(d.origStart, delta)
    return { start: start > d.origEnd ? d.origEnd : start, end: d.origEnd }
  }
  const end = addDaysISO(d.origEnd, delta)
  return { start: d.origStart, end: end < d.origStart ? d.origStart : end }
}

function daySegments(
  viewStart: string,
  span: number,
  holidays: Set<string>,
  today: string,
): Segment[] {
  return eachDayISO(viewStart, addDaysISO(viewStart, span - 1)).map((d) => ({
    key: d,
    label: String(parseDay(d).getDate()),
    sub: WEEKDAY_SHORT[weekday(d)],
    days: 1,
    weekend: isSaturday(d) || isSunday(d),
    isToday: d === today,
    isHoliday: holidays.has(d),
    title: formatDay(d, 'EEEE d/MM/yyyy'),
  }))
}

function weekSegments(viewStart: string, span: number, today: string): Segment[] {
  const out: Segment[] = []
  let cur = viewStart
  let remaining = span
  while (remaining > 0) {
    const monIdx = (weekday(cur) + 6) % 7
    const days = Math.min(7 - monIdx, remaining)
    const end = addDaysISO(cur, days - 1)
    out.push({
      key: cur,
      label: `Sem ${getISOWeek(parseDay(cur))}`,
      sub: formatDay(cur, 'dd/MM'),
      days,
      isToday: today >= cur && today <= end,
      title: `${formatDay(cur)} – ${formatDay(end)}`,
    })
    cur = addDaysISO(cur, days)
    remaining -= days
  }
  return out
}

function monthSegments(viewStart: string, span: number, today: string): Segment[] {
  const out: Segment[] = []
  let cur = viewStart
  let remaining = span
  while (remaining > 0) {
    const d = parseDay(cur)
    const days = Math.min(daysInMonthISO(cur) - d.getDate() + 1, remaining)
    const end = addDaysISO(cur, days - 1)
    out.push({
      key: cur,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      days,
      isToday: today >= cur && today <= end,
    })
    cur = addDaysISO(cur, days)
    remaining -= days
  }
  return out
}

function buildPlaced(
  rows: Task[],
  viewStart: string,
  span: number,
): { placed: PlacedBar[]; lanes: number } {
  const sorted = [...rows].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  )
  const laneEnds: number[] = []
  const placed = sorted.map((t) => {
    const s = Math.max(diffDays(viewStart, t.start), 0)
    const e = Math.min(diffDays(viewStart, t.end), span - 1)
    let lane = laneEnds.findIndex((le) => le < s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(e)
    } else {
      laneEnds[lane] = e
    }
    return { task: t, lane, startIdx: s, endIdx: e }
  })
  return { placed, lanes: Math.max(laneEnds.length, 1) }
}

/** Una franja de líneas por prioridad, en el orden de la Leyenda (la más urgente arriba). */
function buildPlacedByPriority(
  rows: Task[],
  viewStart: string,
  span: number,
  priorityOrder: Map<string, number>,
): { placed: PlacedBar[]; lanes: number } {
  const rank = (t: Task) => priorityOrder.get(t.priorityId) ?? Number.MAX_SAFE_INTEGER
  const byRank = new Map<number, Task[]>()
  for (const t of rows) {
    const r = rank(t)
    byRank.set(r, [...(byRank.get(r) ?? []), t])
  }
  const placed: PlacedBar[] = []
  let offset = 0
  for (const r of [...byRank.keys()].sort((a, b) => a - b)) {
    const band = buildPlaced(byRank.get(r)!, viewStart, span)
    placed.push(...band.placed.map((p) => ({ ...p, lane: p.lane + offset })))
    offset += band.lanes
  }
  return { placed, lanes: Math.max(offset, 1) }
}

interface Props {
  onOpenTask: (id: string) => void
  onNewGroup: () => void
  onEditGroup: (id: string) => void
  hoveredTaskId?: string | null
  fullscreen: boolean
  onToggleFullscreen: () => void
}

export function Cronograma({
  onOpenTask,
  onNewGroup,
  onEditGroup,
  hoveredTaskId,
  fullscreen,
  onToggleFullscreen,
}: Props) {
  const groups = useStore((s) => s.groups)
  const tasks = useStore((s) => s.tasks)
  const priorities = useStore((s) => s.priorities)
  const settings = useStore((s) => s.settings)
  const moveGroup = useStore((s) => s.moveGroup)
  const updateTask = useStore((s) => s.updateTask)

  const [zoom, setZoom] = useState<Zoom>('day')
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed)
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        // sin localStorage la preferencia dura solo la sesión
      }
      return next
    })
  const [preset, setPreset] = useState<Preset>('weeks3')
  const [view, setView] = useState(() => ({
    start: weekStartISO(todayISO()),
    span: 21,
  }))

  const today = todayISO()
  const viewStart = view.start
  const span = view.span
  const viewEnd = addDaysISO(viewStart, span - 1)
  const dw = DAY_WIDTH[zoom]
  const totalW = span * dw
  const monIdx = (weekday(viewStart) + 6) % 7

  const holidaySet = useMemo(() => new Set(settings.holidays), [settings.holidays])
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups],
  )
  const ganttRows = useMemo(
    () => [
      {
        id: UNASSIGNED_ID,
        name: 'Pendientes',
        color: '#94a3b8',
        worksSaturday: true,
        order: -1,
      },
      ...sortedGroups,
    ],
    [sortedGroups],
  )
  const priorityById = useMemo(
    () => new Map(priorities.map((p) => [p.id, p])),
    [priorities],
  )
  const priorityOrder = useMemo(
    () => new Map(priorities.map((p) => [p.id, p.order])),
    [priorities],
  )
  const groupNameById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.name])),
    [groups],
  )

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const t = todayISO()
    if (p === 'week') setView({ start: weekStartISO(t), span: 7 })
    else if (p === 'weeks3') setView({ start: weekStartISO(t), span: 21 })
    else setView({ start: monthStartISO(t), span: daysInMonthISO(t) })
  }

  const shift = (dir: -1 | 1) => {
    if (preset === 'month') {
      const ns = addMonthsISO(viewStart, dir)
      setView({ start: ns, span: daysInMonthISO(ns) })
    } else {
      setView({ start: addDaysISO(viewStart, dir * span), span })
    }
  }

  const goToday = () => {
    setView({ start: preset === 'month' ? monthStartISO(today) : weekStartISO(today), span: preset === 'week' ? 7 : preset === 'weeks3' ? 21 : daysInMonthISO(today) })
  }

  const setZoomMode = (z: Zoom) => {
    setZoom(z)
    if (z === 'month') applyPreset('month')
  }

  const segments =
    zoom === 'day'
      ? daySegments(viewStart, span, holidaySet, today)
      : zoom === 'week'
        ? weekSegments(viewStart, span, today)
        : monthSegments(viewStart, span, today)
  const bandSegments =
    zoom === 'month' ? [] : monthSegments(viewStart, span, today)

  const holidaysInRange = settings.holidays.filter(
    (h) => h >= viewStart && h <= viewEnd,
  )

  const todayIdx = diffDays(viewStart, today)
  const todayInRange = todayIdx >= 0 && todayIdx < span

  const hoveredTask = hoveredTaskId ? tasks.find((t) => t.id === hoveredTaskId) : undefined
  const hoveredSpan =
    hoveredTask && hoveredTask.start <= viewEnd && hoveredTask.end >= viewStart
      ? {
          s: Math.max(diffDays(viewStart, hoveredTask.start), 0),
          e: Math.min(diffDays(viewStart, hoveredTask.end), span - 1),
        }
      : null

  // ---- Drag & drop de barras ----
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const dragging = drag !== null

  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d
        const hoverRowId =
          d.mode === 'move' ? findRowAt(rowElsRef.current, e.clientY) : undefined
        return {
          ...d,
          delta: Math.round((e.clientX - d.startX) / dw),
          moved:
            d.moved || Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3,
          clientX: e.clientX,
          clientY: e.clientY,
          hoverRowId,
        }
      })
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      const moved = Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3
      suppressClickRef.current = moved
      if (!moved) return
      const patch: Partial<Omit<Task, 'id'>> = {}
      const delta = Math.round((e.clientX - d.startX) / dw)
      if (delta !== 0) {
        const { start, end } = applyDelta(d, delta)
        if (start !== d.origStart || end !== d.origEnd) {
          patch.start = start
          patch.end = end
        }
      }
      if (d.mode === 'move') {
        const hoverRowId = findRowAt(rowElsRef.current, e.clientY)
        const task = tasks.find((x) => x.id === d.taskId)
        if (hoverRowId && task) {
          const nextGroupIds = reassignRow(task.groupIds, d.fromRowId, hoverRowId)
          if (nextGroupIds !== task.groupIds) patch.groupIds = nextGroupIds
        }
      }
      if (Object.keys(patch).length > 0) updateTask(d.taskId, patch)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        suppressClickRef.current = true
        dragRef.current = null
        setDrag(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onKey as unknown as EventListener)
    window.addEventListener('keydown', onKey)
    document.body.classList.add('select-none')
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onKey as unknown as EventListener)
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('select-none')
    }
  }, [dragging, dw, updateTask, tasks])

  const startDrag = (
    e: RPointerEvent<HTMLElement>,
    taskId: string,
    mode: DragMode,
    fromRowId: string,
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const t = tasks.find((x) => x.id === taskId)
    if (!t) return
    const d: DragState = {
      taskId,
      mode,
      fromRowId,
      startX: e.clientX,
      startY: e.clientY,
      origStart: t.start,
      origEnd: t.end,
      delta: 0,
      moved: false,
      clientX: e.clientX,
      clientY: e.clientY,
    }
    dragRef.current = d
    setDrag(d)
  }

  const dragPreview = drag ? applyDelta(drag, drag.delta) : null

  const gridBg =
    zoom === 'month'
      ? 'linear-gradient(to right, transparent, transparent)'
      : `repeating-linear-gradient(to right, transparent 0, transparent ${
          dw - 1
        }px, rgba(100,116,139,0.25) ${dw - 1}px, rgba(100,116,139,0.25) ${dw}px)`
  const weekendBg = `repeating-linear-gradient(to right, transparent 0, transparent ${
    5 * dw
  }px, var(--color-slate-100) ${5 * dw}px, var(--color-slate-100) ${6 * dw}px, var(--color-slate-200) ${6 * dw}px, var(--color-slate-200) ${
    7 * dw
  }px)`

  const segBtn = (active: boolean) =>
    `px-2 py-1 text-xs rounded-md ${
      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Cronograma</h2>
        <span className="text-xs text-slate-500">
          {formatDay(viewStart)} – {formatDay(viewEnd)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1">
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              onClick={() => shift(-1)}
              title="Período anterior"
            >
              ◀
            </button>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              onClick={goToday}
            >
              Hoy
            </button>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              onClick={() => shift(1)}
              title="Período siguiente"
            >
              ▶
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Rango:</span>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button className={segBtn(preset === 'week')} onClick={() => applyPreset('week')}>
                Semana
              </button>
              <button
                className={segBtn(preset === 'weeks3')}
                onClick={() => applyPreset('weeks3')}
              >
                3 semanas
              </button>
              <button
                className={segBtn(preset === 'month')}
                onClick={() => applyPreset('month')}
              >
                Mes
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Zoom:</span>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button className={segBtn(zoom === 'day')} onClick={() => setZoomMode('day')}>
                Día
              </button>
              <button className={segBtn(zoom === 'week')} onClick={() => setZoomMode('week')}>
                Semana
              </button>
              <button className={segBtn(zoom === 'month')} onClick={() => setZoomMode('month')}>
                Mes
              </button>
            </div>
          </div>

          <button
            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {fullscreen ? '✕ Salir' : '⛶'}
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8">
          <div className="text-center">
            <p className="text-4xl">🗓</p>
            <p className="mt-2 text-sm text-slate-500">
              Todavía no hay cuadrillas en el cronograma.
            </p>
            <button className={`${btnPrimary} mt-3`} onClick={onNewGroup}>
              + Agregar primera cuadrilla
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="relative" style={{ width: LEFT_W + totalW, minWidth: '100%' }}>
            {/* Encabezado */}
            <div className="sticky top-0 z-40 flex border-b border-slate-300 bg-white">
              <div
                className="sticky left-0 z-50 flex flex-col justify-center border-r-2 border-slate-300 bg-white px-3"
                style={{ width: LEFT_W, minWidth: LEFT_W }}
              >
                <span className="text-xs font-semibold text-slate-600">
                  Cuadrillas ({sortedGroups.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  arrastrá las barras para mover o estirar
                </span>
              </div>
              <div style={{ width: totalW }}>
                {bandSegments.length > 0 && (
                  <div className="flex">
                    {bandSegments.map((m) => (
                      <div
                        key={m.key}
                        className="flex h-[22px] items-center overflow-hidden border-r border-b border-slate-200 px-2 text-[11px] font-semibold whitespace-nowrap text-slate-500"
                        style={{ width: m.days * dw, minWidth: m.days * dw }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex h-[34px]">
                  {segments.map((seg) => (
                    <div
                      key={seg.key}
                      className={`flex flex-col items-center justify-center overflow-hidden border-r border-slate-200 leading-none ${
                        seg.isToday
                          ? 'bg-rose-50 text-rose-600'
                          : seg.isHoliday
                            ? 'bg-rose-100/70 text-rose-700'
                            : seg.weekend
                              ? 'bg-slate-50 text-slate-400'
                              : 'text-slate-600'
                      }`}
                      style={{ width: seg.days * dw, minWidth: seg.days * dw }}
                      title={seg.title}
                    >
                      {seg.sub && (
                        <span className="text-[10px] opacity-70">{seg.sub}</span>
                      )}
                      <span className="text-[11px] font-semibold whitespace-nowrap">
                        {seg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="relative">
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-0"
                style={{
                  left: LEFT_W,
                  width: totalW,
                  backgroundImage: `${gridBg}, ${weekendBg}`,
                  backgroundPosition: `0 0, ${-monIdx * dw}px 0`,
                  backgroundSize: `${dw}px 100%, ${7 * dw}px 100%`,
                  backgroundRepeat: 'repeat',
                }}
              />
              {holidaysInRange.map((h) => (
                <div
                  key={h}
                  className="pointer-events-none absolute top-0 bottom-0 z-0"
                  style={{
                    left: LEFT_W + diffDays(viewStart, h) * dw,
                    width: dw,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(244,63,94,0.10) 0 5px, rgba(244,63,94,0.25) 5px 10px)',
                  }}
                  title={`Feriado: ${formatDay(h)}`}
                />
              ))}

              {hoveredSpan && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-0 bg-sky-400/15"
                  style={{
                    left: LEFT_W + hoveredSpan.s * dw,
                    width: (hoveredSpan.e - hoveredSpan.s + 1) * dw,
                  }}
                />
              )}

              {ganttRows.map((g, rowIdx) => {
                const isUnassigned = g.id === UNASSIGNED_ID
                const rowTasks = tasks.filter(
                  (t) =>
                    (isUnassigned ? t.groupIds.length === 0 : t.groupIds.includes(g.id)) &&
                    t.start <= viewEnd &&
                    t.end >= viewStart,
                )
                const { placed, lanes } = isUnassigned
                  ? buildPlacedByPriority(rowTasks, viewStart, span, priorityOrder)
                  : buildPlaced(rowTasks, viewStart, span)
                const isCollapsed = collapsed.has(g.id)
                const rowH = (isCollapsed ? 1 : lanes) * LANE_H + ROW_PAD * 2
                const isDropTarget =
                  drag?.mode === 'move' && drag.hoverRowId === g.id && drag.fromRowId !== g.id
                const isHoverRow =
                  !!hoveredTask &&
                  (isUnassigned
                    ? hoveredTask.groupIds.length === 0
                    : hoveredTask.groupIds.includes(g.id))
                return (
                  <div
                    key={g.id}
                    ref={(el) => {
                      if (el) rowElsRef.current.set(g.id, el)
                      else rowElsRef.current.delete(g.id)
                    }}
                    className={`group/row flex border-b ${
                      isUnassigned ? 'border-slate-200 border-dashed bg-slate-50/60' : 'border-slate-200'
                    } ${isDropTarget ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''} ${
                      isHoverRow ? 'bg-sky-50/70' : ''
                    }`}
                    style={{ height: rowH }}
                  >
                    <div
                      className="sticky left-0 z-30 flex items-center gap-1.5 border-r-2 border-slate-300 bg-white px-3"
                      style={{ width: LEFT_W, minWidth: LEFT_W }}
                    >
                      <button
                        className="-ml-1.5 w-4 shrink-0 text-sm leading-none text-slate-500 hover:text-slate-800"
                        onClick={() => toggleCollapsed(g.id)}
                        title={isCollapsed ? 'Expandir fila' : 'Colapsar fila'}
                        aria-label={`${isCollapsed ? 'Expandir' : 'Colapsar'} ${g.name}`}
                        aria-expanded={!isCollapsed}
                      >
                        {isCollapsed ? '▸' : '▾'}
                      </button>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: g.color }}
                      />
                      {isUnassigned ? (
                        <span
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-500 italic"
                          title="Tareas sin cuadrilla asignada"
                        >
                          {g.name}
                        </span>
                      ) : (
                        <button
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-slate-950 hover:underline"
                          onClick={() => onEditGroup(g.id)}
                          title={`${g.name} — clic para editar`}
                        >
                          {g.name}
                        </button>
                      )}
                      {!g.worksSaturday && (
                        <span
                          className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-slate-500"
                          title="Esta cuadrilla no trabaja sábados"
                        >
                          sáb ✕
                        </span>
                      )}
                      <span
                        className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                        title={
                          isUnassigned
                            ? 'Tareas sin cuadrilla en este período'
                            : 'Tareas asignadas en este período'
                        }
                      >
                        {rowTasks.length}
                      </span>
                      {isCollapsed && lanes > 1 && (
                        <span
                          className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                          title={`Fila colapsada: hay ${lanes - 1} tarea${lanes - 1 === 1 ? '' : 's'} más superpuesta${lanes - 1 === 1 ? '' : 's'} en paralelo. Tocá ▸ para expandir.`}
                        >
                          +{lanes - 1}
                        </span>
                      )}
                      {!isUnassigned && (
                        <div className="flex shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100">
                          <button
                            className="px-0.5 text-[10px] text-slate-400 hover:text-slate-700"
                            onClick={() => moveGroup(g.id, -1)}
                            title="Subir cuadrilla"
                          >
                            ▲
                          </button>
                          <button
                            className="px-0.5 text-[10px] text-slate-400 hover:text-slate-700"
                            onClick={() => moveGroup(g.id, 1)}
                            title="Bajar cuadrilla"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      className="relative"
                      style={{
                        width: totalW,
                        backgroundImage: isCollapsed
                          ? 'repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--color-slate-400) 18%, transparent) 6px 8px)'
                          : undefined,
                      }}
                      title={isCollapsed ? 'Fila colapsada' : undefined}
                    >
                      {placed.map(({ task: t, lane: realLane }) => {
                        const lane = isCollapsed ? 0 : realLane
                        const preview =
                          drag && drag.taskId === t.id
                            ? applyDelta(drag, drag.delta)
                            : null
                        const isDragging = preview !== null
                        const dispStart = preview?.start ?? t.start
                        const dispEnd = preview?.end ?? t.end
                        const sIdx = diffDays(viewStart, dispStart)
                        const eIdx = diffDays(viewStart, dispEnd)
                        const visS = Math.max(sIdx, 0)
                        const visE = Math.min(eIdx, span - 1)
                        if (visS > visE) return null
                        const prio = priorityById.get(t.priorityId)
                        const color =
                          settings.colorBy === 'priority'
                            ? (prio?.color ?? '#64748b')
                            : STATUS_META[t.status].color
                        const left = visS * dw + 1
                        const width = Math.max((visE - visS + 1) * dw - 2, 6)
                        const top = ROW_PAD + lane * LANE_H
                        const clippedL = dispStart < viewStart
                        const clippedR = dispEnd > viewEnd
                        const satWorks =
                          t.groupIds.length === 0
                            ? true
                            : t.groupIds.some(
                                (id) => groups.find((x) => x.id === id)?.worksSaturday,
                              )
                        const tooltipRight = sIdx > span * 0.5
                        const tooltipBelow = rowIdx === 0 && lane === 0
                        const isHoverBar = t.id === hoveredTaskId
                        const dependents = directDependents(tasks, t.id)
                        const hasConflict = hasDependencyConflict(tasks, t)
                        return (
                          <button
                            key={g.id + t.id}
                            onClick={() => {
                              if (suppressClickRef.current) {
                                suppressClickRef.current = false
                                return
                              }
                              onOpenTask(t.id)
                            }}
                            onPointerDown={(e) => startDrag(e, t.id, 'move', g.id)}
                            className={`group/bar absolute z-10 flex cursor-grab touch-none items-center gap-1 px-1.5 text-left shadow-sm ring-1 ring-black/10 select-none ${
                              isDragging
                                ? 'z-20 cursor-grabbing shadow-lg brightness-105 ring-2 ring-slate-700/50'
                                : 'hover:z-30 hover:brightness-105'
                            } ${clippedL ? 'rounded-l-none' : 'rounded-md'} ${
                              clippedR ? 'rounded-r-none' : 'rounded-md'
                            } ${t.status === 'completada' ? 'opacity-75' : ''} ${
                              isHoverBar
                                ? 'z-30 ring-2 ring-sky-500 brightness-105'
                                : hasConflict
                                  ? 'ring-2 ring-amber-500'
                                  : ''
                            }`}
                            style={{
                              left,
                              top,
                              width,
                              height: BAR_H,
                              background: color,
                              color: contrastText(color),
                            }}
                          >
                            <span
                              className="absolute inset-y-0 left-0 rounded-[inherit] bg-black/20"
                              style={{ width: `${t.progress}%` }}
                            />
                            {(t.offDays ?? [])
                              .filter((d) => {
                                const idx = diffDays(viewStart, d)
                                return idx >= visS && idx <= visE
                              })
                              .map((d) => (
                                <span
                                  key={d}
                                  className="pointer-events-none absolute inset-y-0"
                                  style={{
                                    left: (diffDays(viewStart, d) - visS) * dw,
                                    width: dw,
                                    backgroundImage:
                                      'repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0 4px, rgba(255,255,255,0.1) 4px 8px)',
                                  }}
                                  title={`Sin trabajo el ${formatDay(d)}`}
                                />
                              ))}
                            {width > 20 && (
                              <>
                                <span
                                  className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-ew-resize rounded-l-md bg-white/60 opacity-0 group-hover/bar:opacity-100"
                                  title="Arrastrar para cambiar el inicio"
                                  onPointerDown={(e) => startDrag(e, t.id, 'resize-l', g.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span
                                  className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-ew-resize rounded-r-md bg-white/60 opacity-0 group-hover/bar:opacity-100"
                                  title="Arrastrar para cambiar el fin"
                                  onPointerDown={(e) => startDrag(e, t.id, 'resize-r', g.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </>
                            )}
                            <span className="relative z-10 shrink-0 text-[10px] opacity-90">
                              {STATUS_META[t.status].icon}
                            </span>
                            <span className="relative z-10 min-w-0 flex-1 truncate text-[11px] font-medium">
                              {t.title}
                            </span>
                            {((t.dependsOn?.length ?? 0) > 0 || dependents.length > 0) && (
                              <span className="relative z-10 shrink-0 text-[10px] opacity-90">
                                🔗
                              </span>
                            )}

                            {!isDragging && (
                              <span
                                className={`pointer-events-none absolute z-50 hidden w-64 rounded-lg bg-slate-900/95 p-3 text-left text-[11px] leading-snug text-white shadow-xl group-hover/bar:block ${
                                  tooltipRight ? 'right-0' : 'left-0'
                                } ${
                                  tooltipBelow
                                    ? 'top-full mt-1.5'
                                    : 'bottom-full mb-1.5'
                                }`}
                              >
                                <span className="mb-1 block text-xs font-semibold">
                                  {t.title}
                                </span>
                                <span className="block opacity-90">
                                  {formatDay(t.start)} → {formatDay(t.end)} ·{' '}
                                  {workdayCount(
                                    t.start,
                                    t.end,
                                    satWorks,
                                    new Set([...holidaySet, ...(t.offDays ?? [])]),
                                  )}{' '}
                                  días lab.
                                </span>
                                <span className="block opacity-90">
                                  Estado: {STATUS_META[t.status].label} · Prioridad:{' '}
                                  {prio?.name ?? '—'} · Progreso: {t.progress}%
                                </span>
                                <span className="block opacity-90">
                                  Cuadrillas:{' '}
                                  {t.groupIds
                                    .map((id) => groupNameById.get(id) ?? '?')
                                    .join(', ') || '—'}
                                </span>
                                {t.description && (
                                  <span className="mt-1 block opacity-80">
                                    {t.description}
                                  </span>
                                )}
                                {(t.dependsOn?.length ?? 0) > 0 && (
                                  <span className="mt-1 block opacity-90">
                                    Depende de:{' '}
                                    {t.dependsOn!
                                      .map((id) => tasks.find((x) => x.id === id)?.title ?? '?')
                                      .join(', ')}
                                  </span>
                                )}
                                {dependents.length > 0 && (
                                  <span className="block opacity-90">
                                    Bloquea a: {dependents.map((d) => d.title).join(', ')}
                                  </span>
                                )}
                                {hasConflict && (
                                  <span className="mt-1 block font-medium text-amber-300">
                                    ⚠ Empieza antes de que termine alguna de sus dependencias
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {todayInRange && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 bg-rose-500/70"
                  style={{ left: LEFT_W + (todayIdx + 0.5) * dw - 1 }}
                />
              )}

              {drag && drag.moved && dragPreview && (
                <div
                  className="pointer-events-none fixed z-[70] rounded-lg bg-slate-900/95 px-3 py-2 text-xs leading-snug text-white shadow-xl"
                  style={{ left: drag.clientX + 14, top: drag.clientY + 14 }}
                >
                  <div className="font-semibold">
                    {formatDay(dragPreview.start)} → {formatDay(dragPreview.end)}
                  </div>
                  <div className="opacity-80">
                    {drag.mode === 'move'
                      ? 'Mover tarea'
                      : drag.mode === 'resize-l'
                        ? 'Ajustar inicio'
                        : 'Ajustar fin'}
                    {drag.delta !== 0 &&
                      ` · ${drag.delta > 0 ? '+' : ''}${drag.delta} día${
                        Math.abs(drag.delta) === 1 ? '' : 's'
                      }`}
                    {' · soltá para guardar, Esc cancela'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
