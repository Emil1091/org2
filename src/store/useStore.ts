import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Group, PriorityLevel, Settings, Task } from '../types'
import { addDaysISO, diffDays, todayISO } from '../lib/dates'

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

// ---------- Datos de ejemplo ----------

export function defaultPriorities(): PriorityLevel[] {
  return [
    {
      id: 'p-urgente',
      name: 'Urgente',
      color: '#ef4444',
      description: 'Atender cuanto antes, tiene prioridad sobre todo.',
      order: 0,
    },
    {
      id: 'p-alta',
      name: 'Alta',
      color: '#f97316',
      description: 'Importante, debería completarse esta semana.',
      order: 1,
    },
    {
      id: 'p-media',
      name: 'Media',
      color: '#3b82f6',
      description: 'Planificada dentro del cronograma normal.',
      order: 2,
    },
    {
      id: 'p-baja',
      name: 'Baja',
      color: '#94a3b8',
      description: 'Puede esperar o reprogramarse si surge algo urgente.',
      order: 3,
    },
  ]
}

export function seedData(): AppData {
  const t = todayISO()
  const groups: Group[] = [
    { id: 'g-norte', name: 'Cuadrilla Norte', color: '#2563eb', worksSaturday: true, order: 0 },
    { id: 'g-sur', name: 'Cuadrilla Sur', color: '#16a34a', worksSaturday: true, order: 1 },
    { id: 'g-centro', name: 'Cuadrilla Centro', color: '#7c3aed', worksSaturday: true, order: 2 },
    { id: 'g-soporte', name: 'Cuadrilla Soporte', color: '#ea580c', worksSaturday: false, order: 3 },
  ]
  const tasks: Task[] = [
    {
      id: uid(),
      title: 'Tendido de fibra óptica - Zona Norte',
      description: 'Extensión de red troncal sobre postes existentes.',
      start: addDaysISO(t, -3),
      end: addDaysISO(t, 4),
      status: 'en_progreso',
      priorityId: 'p-urgente',
      groupIds: ['g-norte', 'g-centro'],
      progress: 40,
      notes: '',
    },
    {
      id: uid(),
      title: 'Reparación de acometidas',
      description: 'Reclamos pendientes de clientes en zona Sur.',
      start: addDaysISO(t, -1),
      end: addDaysISO(t, 2),
      status: 'en_progreso',
      priorityId: 'p-alta',
      groupIds: ['g-sur'],
      progress: 60,
      notes: '',
    },
    {
      id: uid(),
      title: 'Instalación de clientes - Barrio Centro',
      description: 'Altas nuevas programadas de la semana.',
      start: t,
      end: addDaysISO(t, 8),
      status: 'pendiente',
      priorityId: 'p-media',
      groupIds: ['g-centro'],
      progress: 0,
      notes: '',
    },
    {
      id: uid(),
      title: 'Mantenimiento de postes y tendido',
      description: 'Revisión preventiva de infraestructura.',
      start: addDaysISO(t, 5),
      end: addDaysISO(t, 12),
      status: 'pendiente',
      priorityId: 'p-media',
      groupIds: ['g-norte', 'g-sur'],
      progress: 0,
      notes: '',
    },
    {
      id: uid(),
      title: 'Migración de OLT - Nodo Sur',
      description: 'Migración de equipamiento con ventana nocturna.',
      start: addDaysISO(t, 9),
      end: addDaysISO(t, 15),
      status: 'pendiente',
      priorityId: 'p-alta',
      groupIds: ['g-sur', 'g-soporte'],
      progress: 0,
      notes: '',
    },
    {
      id: uid(),
      title: 'Revisión de nodos y energía',
      description: 'Chequeo de UPS y tableros en nodos del centro.',
      start: addDaysISO(t, -5),
      end: addDaysISO(t, -2),
      status: 'completada',
      priorityId: 'p-baja',
      groupIds: ['g-soporte'],
      progress: 100,
      notes: '',
    },
  ]
  return {
    groups,
    tasks,
    priorities: defaultPriorities(),
    settings: { colorBy: 'priority', holidays: [] },
  }
}

const emptyData = (): AppData => ({
  groups: [],
  tasks: [],
  priorities: defaultPriorities(),
  settings: { colorBy: 'priority', holidays: [] },
})

// ---------- Store ----------

interface AppStore extends AppData {
  addGroup: (g: Omit<Group, 'id' | 'order'>) => void
  updateGroup: (id: string, patch: Partial<Omit<Group, 'id'>>) => void
  removeGroup: (id: string) => void
  moveGroup: (id: string, dir: -1 | 1) => void

  addTask: (t: Omit<Task, 'id'>) => void
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void
  removeTask: (id: string) => void

  addPriority: (p: Omit<PriorityLevel, 'id' | 'order'>) => void
  updatePriority: (id: string, patch: Partial<Omit<PriorityLevel, 'id'>>) => void
  removePriority: (id: string) => void
  movePriority: (id: string, dir: -1 | 1) => void

  setSettings: (patch: Partial<Settings>) => void

  getData: () => AppData
  importData: (data: AppData) => void
  clearData: () => void
  loadExample: () => void
}

function swap<T extends { id: string; order: number }>(
  list: T[],
  id: string,
  dir: -1 | 1,
): T[] {
  const sorted = [...list].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((x) => x.id === id)
  const target = idx + dir
  if (idx < 0 || target < 0 || target >= sorted.length) return list
  const a = sorted[idx]
  const b = sorted[target]
  return list.map((x) =>
    x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x,
  )
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...seedData(),

      addGroup: (g) =>
        set((s) => ({
          groups: [
            ...s.groups,
            { ...g, id: uid(), order: s.groups.length ? Math.max(...s.groups.map((x) => x.order)) + 1 : 0 },
          ],
        })),

      updateGroup: (id, patch) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),

      removeGroup: (id) =>
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          tasks: s.tasks.map((t) => ({
            ...t,
            groupIds: t.groupIds.filter((gid) => gid !== id),
          })),
        })),

      moveGroup: (id, dir) => set((s) => ({ groups: swap(s.groups, id, dir) })),

      addTask: (t) =>
        set((s) => ({ tasks: [...s.tasks, { ...t, id: uid() }] })),

      updateTask: (id, patch) =>
        set((s) => {
          const prev = s.tasks.find((t) => t.id === id)
          let tasks = s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))

          // Si se movió la fecha de fin, reprograma en cascada a todo lo que depende de esta tarea.
          if (prev && patch.end !== undefined && patch.end !== prev.end) {
            const deltaDays = diffDays(prev.end, patch.end)
            if (deltaDays !== 0) {
              const shifted = new Set<string>([id])
              const queue = [id]
              while (queue.length) {
                const cur = queue.shift()!
                const dependents = tasks.filter(
                  (t) => !shifted.has(t.id) && t.dependsOn?.includes(cur),
                )
                for (const d of dependents) {
                  shifted.add(d.id)
                  queue.push(d.id)
                }
                if (dependents.length) {
                  const ids = new Set(dependents.map((d) => d.id))
                  tasks = tasks.map((t) =>
                    ids.has(t.id)
                      ? {
                          ...t,
                          start: addDaysISO(t.start, deltaDays),
                          end: addDaysISO(t.end, deltaDays),
                        }
                      : t,
                  )
                }
              }
            }
          }

          return { tasks }
        }),

      removeTask: (id) =>
        set((s) => ({
          tasks: s.tasks
            .filter((t) => t.id !== id)
            .map((t) => ({
              ...t,
              dependsOn: t.dependsOn?.filter((x) => x !== id),
            })),
        })),

      addPriority: (p) =>
        set((s) => ({
          priorities: [
            ...s.priorities,
            {
              ...p,
              id: uid(),
              order: s.priorities.length
                ? Math.max(...s.priorities.map((x) => x.order)) + 1
                : 0,
            },
          ],
        })),

      updatePriority: (id, patch) =>
        set((s) => ({
          priorities: s.priorities.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      removePriority: (id) =>
        set((s) => {
          if (s.priorities.length <= 1) return s
          const remaining = s.priorities
            .filter((p) => p.id !== id)
            .sort((a, b) => a.order - b.order)
          const fallback = remaining[0].id
          return {
            priorities: remaining,
            tasks: s.tasks.map((t) =>
              t.priorityId === id ? { ...t, priorityId: fallback } : t,
            ),
          }
        }),

      movePriority: (id, dir) =>
        set((s) => ({ priorities: swap(s.priorities, id, dir) })),

      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      getData: () => {
        const { groups, tasks, priorities, settings } = get()
        return { groups, tasks, priorities, settings }
      },

      importData: (data) => {
        const priorities =
          Array.isArray(data.priorities) && data.priorities.length
            ? data.priorities
            : defaultPriorities()
        // Tareas con prioridad inexistente caen en la primera disponible.
        const valid = new Set(priorities.map((p) => p.id))
        set({
          groups: Array.isArray(data.groups) ? data.groups : [],
          tasks: (Array.isArray(data.tasks) ? data.tasks : []).map((t) => ({
            ...t,
            priorityId: valid.has(t.priorityId) ? t.priorityId : priorities[0].id,
            groupIds: Array.isArray(t.groupIds) ? t.groupIds : [],
            offDays: Array.isArray(t.offDays) ? t.offDays : [],
            dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
          })),
          priorities,
          settings: {
            colorBy: data.settings?.colorBy === 'status' ? 'status' : 'priority',
            holidays: Array.isArray(data.settings?.holidays)
              ? data.settings.holidays
              : [],
          },
        })
      },

      clearData: () => set(emptyData()),

      loadExample: () => set(seedData()),
    }),
    {
      name: 'planificador-cuadrillas',
      version: 1,
    },
  ),
)
