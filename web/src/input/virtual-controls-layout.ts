export type VirtualControlId = 'joystick' | 'btnLB' | 'btnRB'

export interface VirtualControlPosition {
  x: number
  y: number
  opacity?: number
}

export type VirtualControlsLayout = Record<VirtualControlId, VirtualControlPosition>

export const VIRTUAL_CONTROL_LABELS: Record<VirtualControlId, string> = {
  joystick: '摇杆',
  btnLB: 'LB·统计上一页',
  btnRB: 'RB·统计下一页',
}

export const VIRTUAL_CONTROL_IDS: VirtualControlId[] = ['joystick', 'btnLB', 'btnRB']

export const DEFAULT_VIRTUAL_LAYOUT: VirtualControlsLayout = {
  joystick: { x: 0.15, y: 0.84, opacity: 1 },
  btnLB: { x: 0.72, y: 0.84, opacity: 1 },
  btnRB: { x: 0.94, y: 0.84, opacity: 1 },
}

export function normalizeVirtualLayout(layout: Partial<VirtualControlsLayout>): VirtualControlsLayout {
  const next = { ...DEFAULT_VIRTUAL_LAYOUT }
  for (const id of VIRTUAL_CONTROL_IDS) {
    const pos = layout[id]
    if (!pos) continue
    next[id] = {
      x: pos.x,
      y: pos.y,
      opacity: clampOpacity(pos.opacity ?? 1),
    }
  }
  return next
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0.08, Math.min(1, value))
}
