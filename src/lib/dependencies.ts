import type { Task } from '../types'

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
