import { useState } from 'react'
import { TopBar } from './components/TopBar'
import { Cronograma } from './components/Cronograma'
import { TaskList } from './components/TaskList'
import { TaskModal } from './components/TaskModal'
import { GroupModal } from './components/GroupModal'
import { LegendModal } from './components/LegendModal'
import { SettingsModal } from './components/SettingsModal'

type ModalState =
  | { type: 'task'; id?: string }
  | { type: 'group'; id?: string }
  | { type: 'legend' }
  | { type: 'settings' }
  | null

export default function App() {
  const [modal, setModal] = useState<ModalState>(null)

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        onNewTask={() => setModal({ type: 'task' })}
        onNewGroup={() => setModal({ type: 'group' })}
        onOpenLegend={() => setModal({ type: 'legend' })}
        onOpenSettings={() => setModal({ type: 'settings' })}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <Cronograma
          onOpenTask={(id) => setModal({ type: 'task', id })}
          onNewGroup={() => setModal({ type: 'group' })}
          onEditGroup={(id) => setModal({ type: 'group', id })}
        />
        <TaskList
          onOpenTask={(id) => setModal({ type: 'task', id })}
          onNewTask={() => setModal({ type: 'task' })}
        />
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
