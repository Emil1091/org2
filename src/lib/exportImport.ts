import type { AppData, Group, PriorityLevel, Task } from '../types'
import { STATUS_META } from '../types'
import { formatDay, todayISO, workdayCount } from './dates'

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJSON(data: AppData) {
  download(
    `plan-cuadrillas-${todayISO()}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  )
}

/** Valida y normaliza un JSON importado. Lanza Error con mensaje claro si no sirve. */
export function parseImport(text: string): AppData {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const data = obj as Partial<AppData>
  if (!data || typeof data !== 'object')
    throw new Error('El archivo no tiene el formato esperado.')
  if (!Array.isArray(data.groups) || !Array.isArray(data.tasks))
    throw new Error('El archivo no contiene "groups" y "tasks".')
  return {
    groups: data.groups,
    tasks: data.tasks,
    priorities: Array.isArray(data.priorities) ? data.priorities : [],
    settings: {
      colorBy: data.settings?.colorBy === 'status' ? 'status' : 'priority',
      holidays: Array.isArray(data.settings?.holidays) ? data.settings.holidays : [],
    },
  }
}

const csvEscape = (v: unknown): string => {
  const s = String(v ?? '')
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Exporta el listado de tareas a CSV (separador ";" y BOM para Excel en español).
 */
export function exportTasksCSV(
  tasks: Task[],
  groups: Group[],
  priorities: PriorityLevel[],
  holidays: string[],
) {
  const gmap = new Map(groups.map((g) => [g.id, g]))
  const pmap = new Map(priorities.map((p) => [p.id, p]))
  const hset = new Set(holidays)

  const header = [
    'Título',
    'Descripción',
    'Cuadrillas',
    'Inicio',
    'Fin',
    'Días laborables',
    'Estado',
    'Prioridad',
    'Progreso (%)',
    'Notas',
  ]
  const lines = tasks.map((t) => {
    const sat =
      t.groupIds.length === 0
        ? true
        : t.groupIds.some((id) => gmap.get(id)?.worksSaturday)
    return [
      t.title,
      t.description,
      t.groupIds.map((id) => gmap.get(id)?.name ?? '').join(' + '),
      formatDay(t.start),
      formatDay(t.end),
      workdayCount(t.start, t.end, sat, hset),
      STATUS_META[t.status].label,
      pmap.get(t.priorityId)?.name ?? '',
      t.progress,
      t.notes,
    ]
  })
  const csv = [header, ...lines]
    .map((row) => row.map(csvEscape).join(';'))
    .join('\r\n')
  download(`tareas-${todayISO()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8')
}
