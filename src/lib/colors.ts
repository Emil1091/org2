import type { Task, TaskStatus } from '../types'
import { STATUS_META } from '../types'

/** Color con el que se pinta la barra de una tarea (prioridad o estado). */
export function taskBarColor(
  task: Task,
  colorBy: 'priority' | 'status',
  priorityColor?: string,
): string {
  if (colorBy === 'priority') return priorityColor ?? '#64748b'
  return STATUS_META[task.status].color
}

/** Texto legible (blanco/negro) según luminosidad del fondo. */
export function contrastText(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#1e293b' : '#ffffff'
}

/** Color de estado con transparencia. */
export function statusColor(status: TaskStatus, alpha = 1): string {
  const hex = STATUS_META[status].color
  if (alpha >= 1) return hex
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

export const GROUP_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
  '#64748b',
]
