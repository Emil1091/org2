import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { TopBar } from './components/TopBar'
import { Cronograma } from './components/Cronograma'
import { TaskList } from './components/TaskList'
import { TaskModal } from './components/TaskModal'
import { GroupModal } from './components/GroupModal'
import { LegendModal } from './components/LegendModal'
import { SettingsModal } from './components/SettingsModal'
import { AlertsPanel } from './components/AlertsPanel'
import { SplitHandle } from './components/SplitHandle'

type ModalState =
  | { type: 'task'; id?: string }
  | { type: 'group'; id?: string }
  | { type: 'legend' }
  | { type: 'settings' }
  | { type: 'alerts' }
  | null

type Layout = 'stacked' | 'side'

const LAYOUT_KEY = 'gantt-layout'
const PANELS_KEY = 'gantt-panels-collapsed'
const SPLIT_KEY = 'gantt-split-ratio'
const SPLIT_KEY_SIDE = 'gantt-split-ratio-side'

// Apilado (Cronograma arriba): el ratio es la fracción de alto del Cronograma.
const DEFAULT_SPLIT = 0.68
const MIN_SPLIT = 0.3
const MAX_SPLIT = 0.85
const CRONO_MIN_H = 200
const TASKLIST_MIN_H = 140

// Lado a lado (Tareas a la izquierda): el ratio es la fracción de ancho de Tareas.
const DEFAULT_SPLIT_SIDE = 0.32
const MIN_SPLIT_SIDE = 0.2
const MAX_SPLIT_SIDE = 0.6
const TASKLIST_MIN_W = 220
const CRONO_MIN_W = 320

const PANEL_HEADER_H = 45
const PANEL_HEADER_W = 180

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'side' ? 'side' : 'stacked'
  } catch {
    return 'stacked'
  }
}

function readRatio(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key)
    const n = raw ? parseFloat(raw) : NaN
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  } catch {
    return fallback
  }
}

type PanelId = 'crono' | 'tasks'

function readCollapsedPanels(): Record<PanelId, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(PANELS_KEY) ?? '{}')
    return { crono: !!raw.crono, tasks: !!raw.tasks }
  } catch {
    return { crono: false, tasks: false }
  }
}

export default function App() {
  const [modal, setModal] = useState<ModalState>(null)
  const [layout, setLayout] = useState<Layout>(readLayout)
  const [splitRatio, setSplitRatio] = useState(() =>
    readRatio(SPLIT_KEY, DEFAULT_SPLIT, MIN_SPLIT, MAX_SPLIT),
  )
  const [splitRatioSide, setSplitRatioSide] = useState(() =>
    readRatio(SPLIT_KEY_SIDE, DEFAULT_SPLIT_SIDE, MIN_SPLIT_SIDE, MAX_SPLIT_SIDE),
  )
  const [resizing, setResizing] = useState(false)
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [collapsedPanels, setCollapsedPanels] = useState<Record<PanelId, boolean>>(readCollapsedPanels)

  const toggleLayout = () => {
    const next: Layout = layout === 'stacked' ? 'side' : 'stacked'
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      // sin localStorage la preferencia dura solo la sesión
    }
  }

  const togglePanel = (id: PanelId) =>
    setCollapsedPanels((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(PANELS_KEY, JSON.stringify(next))
      } catch {
        // sin localStorage la preferencia dura solo la sesión
      }
      return next
    })
  const mainRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    axis: 'x' | 'y'
    start: number
    startRatio: number
    containerSize: number
  } | null>(null)

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const pos = d.axis === 'x' ? e.clientX : e.clientY
      const deltaRatio = (pos - d.start) / d.containerSize
      if (d.axis === 'x') {
        const minRatio = TASKLIST_MIN_W / d.containerSize
        const maxRatio = 1 - CRONO_MIN_W / d.containerSize
        setSplitRatioSide(Math.min(maxRatio, Math.max(minRatio, d.startRatio + deltaRatio)))
      } else {
        const minRatio = CRONO_MIN_H / d.containerSize
        const maxRatio = 1 - TASKLIST_MIN_H / d.containerSize
        setSplitRatio(Math.min(maxRatio, Math.max(minRatio, d.startRatio + deltaRatio)))
      }
    }
    const onUp = () => {
      const axis = dragRef.current?.axis
      dragRef.current = null
      setResizing(false)
      if (axis === 'x') {
        setSplitRatioSide((r) => {
          try {
            localStorage.setItem(SPLIT_KEY_SIDE, String(r))
          } catch {
            // sin localStorage la preferencia dura solo la sesión
          }
          return r
        })
      } else {
        setSplitRatio((r) => {
          try {
            localStorage.setItem(SPLIT_KEY, String(r))
          } catch {
            // sin localStorage la preferencia dura solo la sesión
          }
          return r
        })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.classList.add('select-none')
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.classList.remove('select-none')
    }
  }, [resizing])

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (fullscreen) {
      setFullscreen(false)
      if (document.fullscreenElement) void document.exitFullscreen()
    } else {
      setFullscreen(true)
      // Si el navegador no permite pantalla completa, igual se ocultan las barras.
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }

  const startResize = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const rect = mainRef.current?.getBoundingClientRect()
    if (!rect) return
    if (layout === 'side') {
      if (rect.width <= 0) return
      dragRef.current = { axis: 'x', start: e.clientX, startRatio: splitRatioSide, containerSize: rect.width }
    } else {
      if (rect.height <= 0) return
      dragRef.current = { axis: 'y', start: e.clientY, startRatio: splitRatio, containerSize: rect.height }
    }
    setResizing(true)
  }

  const cronograma = (
    <Cronograma
      onOpenTask={(id) => setModal({ type: 'task', id })}
      onNewGroup={() => setModal({ type: 'group' })}
      onEditGroup={(id) => setModal({ type: 'group', id })}
      hoveredTaskId={hoveredTaskId}
      fullscreen={fullscreen}
      onToggleFullscreen={toggleFullscreen}
      panelCollapsed={collapsedPanels.crono}
      onTogglePanelCollapsed={() => togglePanel('crono')}
    />
  )

  const taskList = (
    <TaskList
      compact={layout === 'side'}
      panelCollapsed={collapsedPanels.tasks}
      onTogglePanelCollapsed={() => togglePanel('tasks')}
      onOpenTask={(id) => setModal({ type: 'task', id })}
      onNewTask={() => setModal({ type: 'task' })}
      onHoverTask={setHoveredTaskId}
    />
  )

  const cronoPaneStyle =
    layout === 'side'
      ? collapsedPanels.crono
        ? { flexGrow: 0, flexShrink: 0, width: PANEL_HEADER_W, overflow: 'hidden' as const }
        : {
            flexGrow: collapsedPanels.tasks ? 1 : 1 - splitRatioSide,
            flexBasis: 0,
            flexShrink: 1,
            minWidth: CRONO_MIN_W,
            overflow: 'hidden' as const,
          }
      : collapsedPanels.crono
        ? { flexGrow: 0, flexShrink: 0, height: PANEL_HEADER_H, overflow: 'hidden' as const }
        : {
            flexGrow: collapsedPanels.tasks ? 1 : splitRatio,
            flexBasis: 0,
            flexShrink: 1,
            minHeight: CRONO_MIN_H,
            overflow: 'hidden' as const,
          }

  const taskPaneStyle =
    layout === 'side'
      ? collapsedPanels.tasks
        ? { flexGrow: 0, flexShrink: 0, width: PANEL_HEADER_W, overflow: 'hidden' as const }
        : {
            flexGrow: collapsedPanels.crono ? 1 : splitRatioSide,
            flexBasis: 0,
            flexShrink: 1,
            minWidth: TASKLIST_MIN_W,
            overflow: 'hidden' as const,
          }
      : collapsedPanels.tasks
        ? { flexGrow: 0, flexShrink: 0, height: PANEL_HEADER_H, overflow: 'hidden' as const }
        : {
            flexGrow: collapsedPanels.crono ? 1 : 1 - splitRatio,
            flexBasis: 0,
            flexShrink: 1,
            minHeight: TASKLIST_MIN_H,
            overflow: 'hidden' as const,
          }

  const showHandle = !collapsedPanels.crono && !collapsedPanels.tasks
  const handle = (
    <SplitHandle onPointerDown={startResize} orientation={layout === 'side' ? 'vertical' : 'horizontal'} />
  )

  return (
    <div className="flex h-screen flex-col">
      {!fullscreen && (
        <TopBar
          onNewTask={() => setModal({ type: 'task' })}
          onNewGroup={() => setModal({ type: 'group' })}
          onOpenLegend={() => setModal({ type: 'legend' })}
          onOpenSettings={() => setModal({ type: 'settings' })}
          onOpenAlerts={() => setModal({ type: 'alerts' })}
          layout={layout}
          onToggleLayout={toggleLayout}
        />
      )}

      <main
        ref={mainRef}
        className={`flex min-h-0 flex-1 overflow-auto p-3 ${layout === 'side' ? 'flex-row' : 'flex-col'}`}
      >
        {layout === 'side' ? (
          <>
            <div style={taskPaneStyle}>{taskList}</div>
            {showHandle && handle}
            <div style={cronoPaneStyle}>{cronograma}</div>
          </>
        ) : (
          <>
            <div style={cronoPaneStyle}>{cronograma}</div>
            {showHandle && handle}
            <div style={taskPaneStyle}>{taskList}</div>
          </>
        )}
      </main>

      {modal?.type === 'task' && (
        <TaskModal taskId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'group' && (
        <GroupModal groupId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'legend' && <LegendModal onClose={() => setModal(null)} />}
      {modal?.type === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal?.type === 'alerts' && (
        <AlertsPanel
          onOpenTask={(id) => setModal({ type: 'task', id })}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
