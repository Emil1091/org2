import { create } from 'zustand'
import type { AppData, Group, PriorityLevel, Settings, Task } from '../types'
import { addDaysISO, diffDays, todayISO } from '../lib/dates'
import { supabase } from '../lib/supabaseClient'
import {
  groupToRow,
  rowToGroup,
  priorityToRow,
  rowToPriority,
  taskToRow,
  rowToTask,
  settingsToRow,
  rowToSettings,
  SETTINGS_ROW_ID,
  type GroupRow,
  type PriorityRow,
  type TaskRow,
  type SettingsRow,
} from '../lib/db'

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

// ---------- Sync remoto (Supabase) ----------

async function db(label: string, q: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await q
  if (error) console.error(`[db] ${label} falló:`, error)
}

async function replaceAllRemote(data: AppData): Promise<void> {
  await db('borrar tasks', supabase.from('tasks').delete().neq('id', ''))
  await db('borrar groups', supabase.from('groups').delete().neq('id', ''))
  await db('borrar priorities', supabase.from('priorities').delete().neq('id', ''))
  if (data.priorities.length)
    await db('insertar priorities', supabase.from('priorities').insert(data.priorities.map(priorityToRow)))
  if (data.groups.length)
    await db('insertar groups', supabase.from('groups').insert(data.groups.map(groupToRow)))
  if (data.tasks.length)
    await db('insertar tasks', supabase.from('tasks').insert(data.tasks.map(taskToRow)))
  await db('guardar settings', supabase.from('settings').upsert(settingsToRow(data.settings)))
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...list, item]
  const copy = [...list]
  copy[idx] = item
  return copy
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id)
}

function diffOrder<T extends { id: string; order: number }>(prev: T[], next: T[]): T[] {
  const prevOrder = new Map(prev.map((x) => [x.id, x.order]))
  return next.filter((x) => prevOrder.get(x.id) !== x.order)
}

let channel: ReturnType<typeof supabase.channel> | null = null

// ---------- Store ----------

interface AppStore extends AppData {
  ready: boolean
  init: () => Promise<void>
  reset: () => void

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

export const useStore = create<AppStore>()((set, get) => ({
  ...emptyData(),
  ready: false,

  init: async () => {
    if (channel) return
    const ch = supabase.channel('db-changes')
    channel = ch

    const { data: sessionRes } = await supabase.auth.getSession()
    if (sessionRes.session) {
      await supabase.realtime.setAuth(sessionRes.session.access_token)
    }

    ch.on<TaskRow>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        set((s) =>
          payload.eventType === 'DELETE'
            ? { tasks: removeById(s.tasks, (payload.old as TaskRow).id) }
            : { tasks: upsertById(s.tasks, rowToTask(payload.new as TaskRow)) },
        )
      },
    )
      .on<GroupRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        (payload) => {
          set((s) =>
            payload.eventType === 'DELETE'
              ? { groups: removeById(s.groups, (payload.old as GroupRow).id) }
              : { groups: upsertById(s.groups, rowToGroup(payload.new as GroupRow)) },
          )
        },
      )
      .on<PriorityRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'priorities' },
        (payload) => {
          set((s) =>
            payload.eventType === 'DELETE'
              ? { priorities: removeById(s.priorities, (payload.old as PriorityRow).id) }
              : { priorities: upsertById(s.priorities, rowToPriority(payload.new as PriorityRow)) },
          )
        },
      )
      .on<SettingsRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          set({ settings: rowToSettings(payload.new as SettingsRow) })
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[realtime] canal con problemas:', status, err)
        }
      })

    const [groupsRes, tasksRes, prioritiesRes, settingsRes] = await Promise.all([
      supabase.from('groups').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('priorities').select('*'),
      supabase.from('settings').select('*').eq('id', SETTINGS_ROW_ID).single(),
    ])

    set({
      groups: ((groupsRes.data as GroupRow[] | null) ?? []).map(rowToGroup),
      tasks: ((tasksRes.data as TaskRow[] | null) ?? []).map(rowToTask),
      priorities: ((prioritiesRes.data as PriorityRow[] | null) ?? []).map(rowToPriority),
      settings: settingsRes.data ? rowToSettings(settingsRes.data as SettingsRow) : get().settings,
      ready: true,
    })
  },

  reset: () => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    set({ ...emptyData(), ready: false })
  },

  addGroup: (g) => {
    let inserted!: Group
    set((s) => {
      const order = s.groups.length ? Math.max(...s.groups.map((x) => x.order)) + 1 : 0
      inserted = { ...g, id: uid(), order }
      return { groups: [...s.groups, inserted] }
    })
    void db('crear grupo', supabase.from('groups').insert(groupToRow(inserted)))
  },

  updateGroup: (id, patch) => {
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))
    const updated = get().groups.find((g) => g.id === id)
    if (updated) void db('editar grupo', supabase.from('groups').update(groupToRow(updated)).eq('id', id))
  },

  removeGroup: (id) => {
    const affected: Task[] = []
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      tasks: s.tasks.map((t) => {
        if (!t.groupIds.includes(id)) return t
        const nt = { ...t, groupIds: t.groupIds.filter((gid) => gid !== id) }
        affected.push(nt)
        return nt
      }),
    }))
    void db('borrar grupo', supabase.from('groups').delete().eq('id', id))
    if (affected.length) {
      void db('actualizar tareas del grupo', supabase.from('tasks').upsert(affected.map(taskToRow)))
    }
  },

  moveGroup: (id, dir) => {
    let changed: Group[] = []
    set((s) => {
      const swapped = swap(s.groups, id, dir)
      changed = diffOrder(s.groups, swapped)
      return { groups: swapped }
    })
    if (changed.length) {
      void db('reordenar grupos', supabase.from('groups').upsert(changed.map(groupToRow)))
    }
  },

  addTask: (t) => {
    let inserted!: Task
    set((s) => {
      inserted = { ...t, id: uid() }
      return { tasks: [...s.tasks, inserted] }
    })
    void db('crear tarea', supabase.from('tasks').insert(taskToRow(inserted)))
  },

  updateTask: (id, patch) => {
    const touchedIds = new Set<string>([id])

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
              touchedIds.add(d.id)
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
    })

    const touched = get().tasks.filter((t) => touchedIds.has(t.id))
    if (touched.length) void db('editar tarea', supabase.from('tasks').upsert(touched.map(taskToRow)))
  },

  removeTask: (id) => {
    const affected: Task[] = []
    set((s) => ({
      tasks: s.tasks
        .filter((t) => t.id !== id)
        .map((t) => {
          if (!t.dependsOn?.includes(id)) return t
          const nt = { ...t, dependsOn: t.dependsOn.filter((x) => x !== id) }
          affected.push(nt)
          return nt
        }),
    }))
    void db('borrar tarea', supabase.from('tasks').delete().eq('id', id))
    if (affected.length) {
      void db('actualizar dependencias', supabase.from('tasks').upsert(affected.map(taskToRow)))
    }
  },

  addPriority: (p) => {
    let inserted!: PriorityLevel
    set((s) => {
      const order = s.priorities.length
        ? Math.max(...s.priorities.map((x) => x.order)) + 1
        : 0
      inserted = { ...p, id: uid(), order }
      return { priorities: [...s.priorities, inserted] }
    })
    void db('crear prioridad', supabase.from('priorities').insert(priorityToRow(inserted)))
  },

  updatePriority: (id, patch) => {
    set((s) => ({
      priorities: s.priorities.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
    const updated = get().priorities.find((p) => p.id === id)
    if (updated)
      void db('editar prioridad', supabase.from('priorities').update(priorityToRow(updated)).eq('id', id))
  },

  removePriority: (id) => {
    const fallbackApplied: Task[] = []
    let removed = false
    set((s) => {
      if (s.priorities.length <= 1) return s
      const remaining = s.priorities
        .filter((p) => p.id !== id)
        .sort((a, b) => a.order - b.order)
      const fallback = remaining[0].id
      removed = true
      return {
        priorities: remaining,
        tasks: s.tasks.map((t) => {
          if (t.priorityId !== id) return t
          const nt = { ...t, priorityId: fallback }
          fallbackApplied.push(nt)
          return nt
        }),
      }
    })
    if (!removed) return
    void db('borrar prioridad', supabase.from('priorities').delete().eq('id', id))
    if (fallbackApplied.length) {
      void db('reasignar prioridad', supabase.from('tasks').upsert(fallbackApplied.map(taskToRow)))
    }
  },

  movePriority: (id, dir) => {
    let changed: PriorityLevel[] = []
    set((s) => {
      const swapped = swap(s.priorities, id, dir)
      changed = diffOrder(s.priorities, swapped)
      return { priorities: swapped }
    })
    if (changed.length) {
      void db('reordenar prioridades', supabase.from('priorities').upsert(changed.map(priorityToRow)))
    }
  },

  setSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    void db('guardar ajustes', supabase.from('settings').upsert(settingsToRow(get().settings)))
  },

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
    const groups = Array.isArray(data.groups) ? data.groups : []
    const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map((t) => ({
      ...t,
      priorityId: valid.has(t.priorityId) ? t.priorityId : priorities[0].id,
      groupIds: Array.isArray(t.groupIds) ? t.groupIds : [],
      offDays: Array.isArray(t.offDays) ? t.offDays : [],
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
    }))
    const settings: Settings = {
      colorBy: data.settings?.colorBy === 'status' ? 'status' : 'priority',
      holidays: Array.isArray(data.settings?.holidays) ? data.settings.holidays : [],
    }
    set({ groups, tasks, priorities, settings })
    void replaceAllRemote({ groups, tasks, priorities, settings })
  },

  clearData: () => {
    const data = emptyData()
    set(data)
    void replaceAllRemote(data)
  },

  loadExample: () => {
    const data = seedData()
    set(data)
    void replaceAllRemote(data)
  },
}))
