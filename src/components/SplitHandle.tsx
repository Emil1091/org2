import type { PointerEvent as RPointerEvent } from 'react'

interface Props {
  onPointerDown: (e: RPointerEvent<HTMLDivElement>) => void
  orientation?: 'horizontal' | 'vertical'
}

export function SplitHandle({ onPointerDown, orientation = 'horizontal' }: Props) {
  const isVertical = orientation === 'vertical'
  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      onPointerDown={onPointerDown}
      className={`group flex shrink-0 touch-none items-center justify-center ${
        isVertical ? 'w-2.5 cursor-col-resize' : 'h-2.5 cursor-row-resize'
      }`}
      title="Arrastrar para ajustar el espacio"
    >
      <div
        className={`rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400 ${
          isVertical ? 'h-10 w-1' : 'h-1 w-10'
        }`}
      />
    </div>
  )
}
