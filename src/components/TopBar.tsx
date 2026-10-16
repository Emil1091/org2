import { useRef } from 'react'
import { useStore } from '../store/useStore'
import { exportJSON, parseImport } from '../lib/exportImport'
import { btnPrimary, btnSecondary } from './Modal'

interface Props {
  onNewTask: () => void
  onNewGroup: () => void
  onOpenLegend: () => void
  onOpenSettings: () => void
}

export function TopBar({ onNewTask, onNewGroup, onOpenLegend, onOpenSettings }: Props) {
  const getData = useStore((s) => s.getData)
  const importData = useStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const data = parseImport(text)
      importData(data)
      alert('Plan importado correctamente.')
    } catch (err) {
      alert(`No se pudo importar: ${err instanceof Error ? err.message : 'archivo inválido'}`)
    }
  }

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

      <button className={btnSecondary} onClick={onOpenLegend} title="Prioridades y estados">
        🎨 Leyenda
      </button>
      <button className={btnSecondary} onClick={onOpenSettings} title="Ajustes">
        ⚙ Ajustes
      </button>
      <button
        className={btnSecondary}
        onClick={() => exportJSON(getData())}
        title="Descargar el plan como JSON"
      >
        ⬆ Exportar
      </button>
      <button
        className={btnSecondary}
        onClick={() => fileRef.current?.click()}
        title="Importar un plan JSON"
      >
        ⬇ Importar
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void onImportFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button className={btnSecondary} onClick={onNewGroup}>
        + Cuadrilla
      </button>
      <button className={btnPrimary} onClick={onNewTask}>
        ＋ Nueva tarea
      </button>
    </header>
  )
}
