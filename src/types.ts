// ---- Modelo de datos ----

export type TaskStatus =
  | 'pendiente'
  | 'en_progreso'
  | 'pausada'
  | 'bloqueada'
  | 'completada'

export interface Group {
  id: string
  name: string
  color: string
  worksSaturday: boolean
  order: number
}

export interface PriorityLevel {
  id: string
  name: string
  color: string
  description: string
  order: number
}

export interface Task {
  id: string
  title: string
  description: string
  /** Fecha ISO 'YYYY-MM-DD' (local) */
  start: string
  /** Fecha ISO 'YYYY-MM-DD' (local) */
  end: string
  status: TaskStatus
  priorityId: string
  groupIds: string[]
  /** 0..100 */
  progress: number
  notes: string
}

export type ColorSource = 'priority' | 'status'

export interface Settings {
  colorBy: ColorSource
  /** Feriados como 'YYYY-MM-DD' */
  holidays: string[]
}

export interface AppData {
  groups: Group[]
  tasks: Task[]
  priorities: PriorityLevel[]
  settings: Settings
}

export const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string; icon: string }
> = {
  pendiente: { label: 'Pendiente', color: '#94a3b8', icon: '○' },
  en_progreso: { label: 'En progreso', color: '#22c55e', icon: '▶' },
  pausada: { label: 'Pausada', color: '#f59e0b', icon: '⏸' },
  bloqueada: { label: 'Bloqueada', color: '#ef4444', icon: '⛔' },
  completada: { label: 'Completada', color: '#0ea5e9', icon: '✓' },
}

export const STATUS_ORDER: TaskStatus[] = [
  'pendiente',
  'en_progreso',
  'pausada',
  'bloqueada',
  'completada',
]
