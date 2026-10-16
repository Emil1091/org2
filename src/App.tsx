import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { TopBar } from './components/TopBar'
import { Cronograma } from './components/Cronograma'
import { TaskList } from './components/TaskList'
import { TaskModal } from './components/TaskModal'
import { GroupModal } from './components/GroupModal'
import { LegendModal } from './components/LegendModal'
import { SettingsModal } from './components/SettingsModal'
import { SplitHandle } from './components/SplitHandle'

type ModalState =
  | { type: 'task'; id?: string }
  | { type: 'group'; id?: string }
  | { type: 'legend' }
  | { type: 'settings' }
  | null

const SPLIT_KEY = 'gantt-split-ratio'
const DEFAULT_SPLIT = 0.68
const MIN_SPLIT = 0.3
const MAX_SPLIT = 0.85
const CRONO_MIN_H = 200
const TASKLIST_MIN_H = 140

function readSplitRatio(): number {
  try {
    const raw = localStorage.getItem(SPLIT_KEY)
    const n = raw ? parseFloat(raw) : NaN
    if (!Number.isFinite(n)) return DEFAULT_SPLIT
    return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, n))
  } catch {
    return DEFAULT_SPLIT
  }
}

export default function App() {
  const [modal, setModal] = useState<ModalState>(null)
  const [splitRatio, setSplitRatio] = useState(readSplitRatio)
  const [resizing, setResizing] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startRatio: number; containerH: number } | null>(null)

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const deltaRatio = (e.clientY - d.startY) / d.containerH
      const minRatio = CRONO_MIN_H / d.containerH
      const maxRatio = 1 - TASKLIST_MIN_H / d.containerH
      const next = Math.min(maxRatio, Math.max(minRatio, d.startRatio + deltaRatio))
      setSplitRatio(next)
    }
    const onUp = () => {
      dragRef.current = null
      setResizing(false)
      setSplitRatio((r) => {
        try {
          localStorage.setItem(SPLIT_KEY, String(r))
        } catch {
          // localStorage no disponible: la preferencia solo dura la sesión
        }
        return r
      })
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

  const startResize = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const containerH = mainRef.current?.getBoundingClientRect().height ?? 0
    if (containerH <= 0) return
    dragRef.current = { startY: e.clientY, startRatio: splitRatio, containerH }
    setResizing(true)
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        onNewTask={() => setModal({ type: 'task' })}
        onNewGroup={() => setModal({ type: 'group' })}
        onOpenLegend={() => setModal({ type: 'legend' })}
        onOpenSettings={() => setModal({ type: 'settings' })}
      />

      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        <div
          style={{ flexGrow: splitRatio, flexBasis: 0, flexShrink: 1, minHeight: CRONO_MIN_H, overflow: 'hidden' }}
        >
          <Cronograma
            onOpenTask={(id) => setModal({ type: 'task', id })}
            onNewGroup={() => setModal({ type: 'group' })}
            onEditGroup={(id) => setModal({ type: 'group', id })}
          />
        </div>

        <SplitHandle onPointerDown={startResize} />

        <div
          style={{
            flexGrow: 1 - splitRatio,
            flexBasis: 0,
            flexShrink: 1,
            minHeight: TASKLIST_MIN_H,
            overflow: 'hidden',
          }}
        >
          <TaskList
            onOpenTask={(id) => setModal({ type: 'task', id })}
            onNewTask={() => setModal({ type: 'task' })}
          />
        </div>
      </main>

      {modal?.type === 'task' && (
        <TaskModal taskId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'group' && (
        <GroupModal groupId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'legend' && <LegendModal onClose={() => setModal(null)} />}
      {modal?.type === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
    </div>
  )
}
