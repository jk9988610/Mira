import type { VirtualControlPosition } from './virtual-controls-layout'

/** 布局网格步长（屏幕比例） */
export const LAYOUT_GRID_STEP = 0.05

export function snapLayoutValue(value: number, step = LAYOUT_GRID_STEP): number {
  const snapped = Math.round(value / step) * step
  return Math.max(step, Math.min(1 - step, snapped))
}

export function snapPosition(
  pos: VirtualControlPosition,
  step = LAYOUT_GRID_STEP,
): VirtualControlPosition {
  return { x: snapLayoutValue(pos.x, step), y: snapLayoutValue(pos.y, step) }
}
