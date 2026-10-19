import { useState } from 'react'
import { useStore } from '../store/useStore'
import { STATUS_META, STATUS_ORDER, type Task, type TaskStatus } from '../types'
import { addDaysISO, diffDays, formatDay, todayISO, workdayCount } from '../lib/dates'
import { hasDependencyConflict, minStartFor, wouldCreateCycle } from '../lib/dependencies'
import { Field, Modal, btnDanger, btnPrimary, btnSecondary, inputCls } from './Modal'

interface Props {
  /** Si viene, se edita la tarea con ese id; si no, se crea una nueva. */
  taskId?: string
  onClose: () => void
}

export function TaskModal({ taskId, onClose }: Props) {
  const task = useStore((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined))
  const tasks = useStore((s) => s.tasks)
  const groups = useStore((s) => s.groups)
  const priorities = useStore((s) => s.priorities)
  const holidays = useStore((s) => s.settings.holidays)
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)
  const removeTask = useStore((s) => s.removeTask)

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)
  const sortedPriorities = [...priorities].sort((a, b) => a.order - b.order)

  const [form, setForm] = useState(() => {
    if (task) return { ...task }
    const t = todayISO()
    return {
      id: '',
      title: '',
      description: '',
      start: t,
      end: addDaysISO(t, 2),
      status: 'pendiente' as TaskStatus,
      priorityId: sortedPriorities[0]?.id ?? '',
      groupIds: [] as string[],
      progress: 0,
      notes: '',
      offDays: [] as string[],
      dependsOn: [] as string[],
    } satisfies Task
  })

  const [newOffDay, setNewOffDay] = useState('')

  const set = (patch: Partial<Task>) => setForm((f) => ({ ...f, ...patch }))

  const offDays = [...(form.offDays ?? [])].sort()
  const holidaySet = new Set([...holidays, ...offDays])
  const saturdayWorks =
    form.groupIds.length === 0
      ? true
      : form.groupIds.some((id) => groups.find((g) => g.id === id)?.worksSaturday)
  const duration = workdayCount(form.start, form.end, saturdayWorks, holidaySet)

  const otherTasks = tasks.filter((t) => t.id !== form.id)
  const minStart = minStartFor(otherTasks, form.dependsOn)
  const toggleDependency = (depId: string) => {
    const has = (form.dependsOn ?? []).includes(depId)
    const next = has
      ? (form.dependsOn ?? []).filter((x) => x !== depId)
      : [...(form.dependsOn ?? []), depId]
    if (!has && wouldCreateCycle(tasks, form.id || '__nueva__', next)) {
      alert('Esa dependencia generaría un ciclo: una tarea no puede depender, directa o indirectamente, de sí misma.')
      return
    }
    // Al agregar una dependencia, esta tarea empieza después de que la otra termine, no antes.
    if (!has) {
      const dep = tasks.find((t) => t.id === depId)
      if (dep && dep.end >= form.start) {
        const start = addDaysISO(dep.end, 1)
        const deltaDays = diffDays(form.start, start)
        set({ dependsOn: next, start, end: addDaysISO(form.end, deltaDays) })
        return
      }
    }
    set({ dependsOn: next })
  }
  const dependencyConflict = hasDependencyConflict(tasks, form)

  const save = () => {
    if (!form.title.trim()) {
      alert('La tarea necesita un título.')
      return
    }
    const start = minStart && form.start < minStart ? minStart : form.start
    const end = form.end < start ? start : form.end
    const payload = {
      ...form,
      title: form.title.trim(),
      end,
      offDays: (form.offDays ?? []).filter((d) => d >= start && d <= end),
    }
    if (taskId) {
      updateTask(taskId, payload)
    } else {
      addTask(payload)
    }
    onClose()
  }

  const del = () => {
    if (!confirm(`¿Eliminar la tarea "${form.title}"?`)) return
    removeTask(form.id)
    onClose()
  }

  const toggleGroup = (id: string) => {
    setForm((f) => ({
      ...f,
      groupIds: f.groupIds.includes(id)
        ? f.groupIds.filter((g) => g !== id)
        : [...f.groupIds, id],
    }))
  }

  return (
    <Modal
      title={taskId ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      wide
      footer={
        <>
          {taskId && (
            <button className={btnDanger} onClick={del}>
              Eliminar
            </button>
          )}
          <div className="flex-1" />
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} onClick={save}>
            Guardar
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Título">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Ej: Tendido de fibra óptica - Zona Norte"
              autoFocus
            />
          </Field>
        </div>

        <Field
          label="Inicio estimado"
          hint={minStart ? `No puede ser antes del ${formatDay(minStart)} (depende de otra tarea).` : undefined}
        >
          <input
            type="date"
            className={inputCls}
            value={form.start}
            min={minStart ?? undefined}
            onChange={(e) => {
              const v = e.target.value || form.start
              set({ start: minStart && v < minStart ? minStart : v })
            }}
          />
        </Field>
        <Field label="Fin estimado">
          <input
            type="date"
            className={inputCls}
            value={form.end}
            min={form.start}
            onChange={(e) => set({ end: e.target.value || form.end })}
          />
        </Field>

        <div className="sm:col-span-2 -mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Duración: <strong>{duration}</strong> día{duration === 1 ? '' : 's'} laborable
          {duration === 1 ? '' : 's'} (domingos excluidos
          {saturdayWorks ? ', sábados incluidos' : ', sábados excluidos'}; feriados
          {offDays.length > 0 ? ' y días sin trabajar ' : ' '}
          excluidos).
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Días sin trabajar"
            hint="Quedan dentro del rango de la tarea, pero no cuentan como días laborables."
          >
            <div className="flex gap-2">
              <input
                type="date"
                className={`${inputCls} max-w-52`}
                value={newOffDay}
                min={form.start}
                max={form.end}
                onChange={(e) => setNewOffDay(e.target.value)}
              />
              <button
                className={btnSecondary}
                onClick={() => {
                  if (!newOffDay || offDays.includes(newOffDay)) return
                  if (newOffDay < form.start || newOffDay > form.end) return
                  set({ offDays: [...(form.offDays ?? []), newOffDay] })
                  setNewOffDay('')
                }}
              >
                + Agregar
              </button>
            </div>
            {offDays.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {offDays.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {formatDay(d)}
                    <button
                      className="text-slate-400 hover:text-slate-700"
                      onClick={() =>
                        set({ offDays: (form.offDays ?? []).filter((x) => x !== d) })
                      }
                      aria-label={`Quitar día sin trabajar ${d}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </div>

        <Field label="Estado">
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => set({ status: e.target.value as TaskStatus })}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prioridad">
          <div className="flex items-center gap-2">
            <select
              className={inputCls}
              value={form.priorityId}
              onChange={(e) => set({ priorityId: e.target.value })}
            >
              {sortedPriorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span
              className="h-6 w-6 shrink-0 rounded-md border border-slate-200"
              style={{
                background: sortedPriorities.find((p) => p.id === form.priorityId)?.color,
              }}
              title="Color de prioridad"
            />
          </div>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Cuadrillas asignadas"
            hint="La tarea se dibuja en el cronograma dentro de cada cuadrilla elegida."
          >
            {sortedGroups.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay cuadrillas todavía. Creá una desde la barra superior.
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {sortedGroups.map((g) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.groupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: g.color }}
                    />
                    <span className="truncate">{g.name}</span>
                    {!g.worksSaturday && (
                      <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                        sin sábados
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Depende de"
            hint="Esta tarea no puede empezar hasta que las elegidas terminen. Si alguna se atrasa, esta se reprograma sola."
          >
            {otherTasks.length === 0 ? (
              <p className="text-sm text-slate-500">No hay otras tareas todavía.</p>
            ) : (
              <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {otherTasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={(form.dependsOn ?? []).includes(t.id)}
                      onChange={() => toggleDependency(t.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDay(t.end)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {dependencyConflict && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                ⚠ El inicio de esta tarea es antes de que termine alguna de las que depende.
              </p>
            )}
          </Field>
        </div>

        <Field label={`Progreso: ${form.progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress}
            onChange={(e) => set({ progress: Number(e.target.value) })}
            className="w-full"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Descripción">
            <textarea
              className={inputCls}
              rows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Detalle breve del trabajo a realizar"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Notas">
            <textarea
              className={inputCls}
              rows={2}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Materiales, contacto, observaciones..."
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
