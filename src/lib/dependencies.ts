import type { Task } from '../types'
import { addDaysISO } from './dates'

/** True si hacer que `taskId` dependa de `dependsOn` generaría un ciclo. */
export function wouldCreateCycle(tasks: Task[], taskId: string, dependsOn: string[]): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const visited = new Set<string>()
  const stack = [...dependsOn]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === taskId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    const t = byId.get(cur)
    if (t?.dependsOn) stack.push(...t.dependsOn)
  }
  return false
}

/** Tareas que dependen directamente de `taskId`. */
export function directDependents(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((t) => t.dependsOn?.includes(taskId))
}

/** True si alguna de las tareas de las que depende `t` todavía no terminó cuando `t` arranca. */
export function hasDependencyConflict(tasks: Task[], t: Task): boolean {
  if (!t.dependsOn?.length) return false
  const byId = new Map(tasks.map((x) => [x.id, x]))
  return t.dependsOn.some((id) => {
    const dep = byId.get(id)
    return dep !== undefined && dep.end >= t.start
  })
}

/** Primer día en que puede arrancar una tarea con estas dependencias (el siguiente a la que termine más tarde), o null si no depende de nada. */
export function minStartFor(tasks: Task[], dependsOn: string[] | undefined): string | null {
  if (!dependsOn?.length) return null
  const byId = new Map(tasks.map((x) => [x.id, x]))
  let min: string | null = null
  for (const id of dependsOn) {
    const dep = byId.get(id)
    if (!dep) continue
    const candidate = addDaysISO(dep.end, 1)
    if (min === null || candidate > min) min = candidate
  }
  return min
}
