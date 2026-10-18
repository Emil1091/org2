import type { ColorSource, Group, PriorityLevel, Settings, Task, TaskStatus } from '../types'

export interface GroupRow {
  id: string
  name: string
  color: string
  works_saturday: boolean
  order_index: number
}

export interface PriorityRow {
  id: string
  name: string
  color: string
  description: string
  order_index: number
}

export interface TaskRow {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  status: TaskStatus
  priority_id: string
  group_ids: string[]
  progress: number
  notes: string
  off_days: string[]
  depends_on: string[]
}

export interface SettingsRow {
  id: 'singleton'
  color_by: ColorSource
  holidays: string[]
}

export const SETTINGS_ROW_ID = 'singleton' as const

export function rowToGroup(r: GroupRow): Group {
  return { id: r.id, name: r.name, color: r.color, worksSaturday: r.works_saturday, order: r.order_index }
}

export function groupToRow(g: Group): GroupRow {
  return { id: g.id, name: g.name, color: g.color, works_saturday: g.worksSaturday, order_index: g.order }
}

export function rowToPriority(r: PriorityRow): PriorityLevel {
  return { id: r.id, name: r.name, color: r.color, description: r.description, order: r.order_index }
}

export function priorityToRow(p: PriorityLevel): PriorityRow {
  return { id: p.id, name: p.name, color: p.color, description: p.description, order_index: p.order }
}

export function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    start: r.start_date,
    end: r.end_date,
    status: r.status,
    priorityId: r.priority_id,
    groupIds: r.group_ids ?? [],
    progress: r.progress,
    notes: r.notes,
    offDays: r.off_days ?? [],
    dependsOn: r.depends_on ?? [],
  }
}

export function taskToRow(t: Task): TaskRow {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    start_date: t.start,
    end_date: t.end,
    status: t.status,
    priority_id: t.priorityId,
    group_ids: t.groupIds,
    progress: t.progress,
    notes: t.notes,
    off_days: t.offDays ?? [],
    depends_on: t.dependsOn ?? [],
  }
}

export function rowToSettings(r: SettingsRow): Settings {
  return { colorBy: r.color_by, holidays: r.holidays ?? [] }
}

export function settingsToRow(s: Settings): SettingsRow {
  return { id: SETTINGS_ROW_ID, color_by: s.colorBy, holidays: s.holidays }
}
