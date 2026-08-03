export type VirtualControlId =
  | 'joystick'
  | 'btnA'
  | 'btnB'
  | 'btnX'
  | 'btnY'

export interface VirtualControlPosition {
  x: number
  y: number
  opacity?: number
}

export type VirtualControlsLayout = Record<VirtualControlId, VirtualControlPosition>

export const VIRTUAL_CONTROL_LABELS: Record<VirtualControlId, string> = {
  joystick: '摇杆',
  btnA: 'A',
  btnB: 'B',
  btnX: 'X',
  btnY: 'Y',
}

export const VIRTUAL_CONTROL_IDS: VirtualControlId[] = [
  'joystick',
  'btnA',
  'btnB',
  'btnX',
  'btnY',
]

const ABXY = { cx: 0.86, cy: 0.74, gap: 0.1 }

export const DEFAULT_VIRTUAL_LAYOUT: VirtualControlsLayout = {
  joystick: { x: 0.15, y: 0.84, opacity: 1 },
  btnY: { x: ABXY.cx, y: ABXY.cy - ABXY.gap, opacity: 1 },
  btnX: { x: ABXY.cx - ABXY.gap, y: ABXY.cy, opacity: 1 },
  btnB: { x: ABXY.cx + ABXY.gap, y: ABXY.cy, opacity: 1 },
  btnA: { x: ABXY.cx, y: ABXY.cy + ABXY.gap, opacity: 1 },
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
