import type { Group, Task } from '../types'
import { diffDays, workdayCount } from './dates'
import { hasDependencyConflict } from './dependencies'

export type AlertKind = 'not_started' | 'overdue' | 'long_duration' | 'dependency_conflict'

export interface TaskAlert {
  taskId: string
  kind: AlertKind
  /** Días de atraso (not_started/overdue) o días laborables planificados (long_duration) */
  days: number
}

/** Umbral de días laborables a partir del cual una tarea se considera "de larga duración". */
export const LONG_DURATION_DAYS = 15

function satWorksFor(task: Task, groups: Group[]): boolean {
  if (task.groupIds.length === 0) return true
  return task.groupIds.some((id) => groups.find((g) => g.id === id)?.worksSaturday)
}

/** Calcula las alertas de atraso/espera/larga duración para el set de tareas dado. */
export function computeAlerts(
  tasks: Task[],
  groups: Group[],
  holidaySet: Set<string>,
  today: string,
): TaskAlert[] {
  const alerts: TaskAlert[] = []

  for (const t of tasks) {
    if (t.status === 'completada') {
      // una tarea completada no dispara "sin iniciar" ni "vencida"
    } else {
      if (t.status === 'pendiente' && today > t.start) {
        alerts.push({ taskId: t.id, kind: 'not_started', days: diffDays(t.start, today) })
      }
      if (today > t.end) {
        alerts.push({ taskId: t.id, kind: 'overdue', days: diffDays(t.end, today) })
      }
    }

    const offDays = new Set([...holidaySet, ...(t.offDays ?? [])])
    const workdays = workdayCount(t.start, t.end, satWorksFor(t, groups), offDays)
    if (workdays > LONG_DURATION_DAYS) {
      alerts.push({ taskId: t.id, kind: 'long_duration', days: workdays })
    }

    if (hasDependencyConflict(tasks, t)) {
      alerts.push({ taskId: t.id, kind: 'dependency_conflict', days: 0 })
    }
  }

  return alerts
}
