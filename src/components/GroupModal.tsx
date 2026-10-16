import { useState } from 'react'
import { useStore } from '../store/useStore'
import { GROUP_PALETTE } from '../lib/colors'
import { Field, Modal, btnDanger, btnPrimary, btnSecondary, inputCls } from './Modal'

interface Props {
  groupId?: string
  onClose: () => void
}

export function GroupModal({ groupId, onClose }: Props) {
  const group = useStore((s) => (groupId ? s.groups.find((g) => g.id === groupId) : undefined))
  const addGroup = useStore((s) => s.addGroup)
  const updateGroup = useStore((s) => s.updateGroup)
  const removeGroup = useStore((s) => s.removeGroup)

  const [form, setForm] = useState(() =>
    group
      ? { name: group.name, color: group.color, worksSaturday: group.worksSaturday }
      : { name: '', color: GROUP_PALETTE[0], worksSaturday: true },
  )

  const save = () => {
    if (!form.name.trim()) {
      alert('La cuadrilla necesita un nombre.')
      return
    }
    if (groupId) {
      updateGroup(groupId, { ...form, name: form.name.trim() })
    } else {
      addGroup({ ...form, name: form.name.trim() })
    }
    onClose()
  }

  const del = () => {
    if (!confirm(`¿Eliminar la cuadrilla "${form.name}"? Se quitará de las tareas asignadas.`))
      return
    if (groupId) removeGroup(groupId)
    onClose()
  }

  return (
    <Modal
      title={groupId ? 'Editar cuadrilla' : 'Nueva cuadrilla'}
      onClose={onClose}
      footer={
        <>
          {groupId && (
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
      <div className="grid gap-4">
        <Field label="Nombre">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Cuadrilla Norte"
            autoFocus
          />
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
            {GROUP_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-7 w-7 rounded-full border-2 ${
                  form.color === c ? 'border-slate-800' : 'border-transparent'
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.worksSaturday}
            onChange={(e) => setForm((f) => ({ ...f, worksSaturday: e.target.checked }))}
          />
          Trabaja sábados (por defecto las cuadrillas trabajan los sábados)
        </label>
      </div>
    </Modal>
  )
}
