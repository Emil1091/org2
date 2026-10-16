import type { PointerEvent as RPointerEvent } from 'react'

interface Props {
  onPointerDown: (e: RPointerEvent<HTMLDivElement>) => void
}

export function SplitHandle({ onPointerDown }: Props) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={onPointerDown}
      className="group flex h-2.5 shrink-0 cursor-row-resize touch-none items-center justify-center"
      title="Arrastrar para ajustar el espacio"
    >
      <div className="h-1 w-10 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400" />
    </div>
  )
}
