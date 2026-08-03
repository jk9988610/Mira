import type { VirtualControlsLayout } from '../input/virtual-controls-layout'
import { DEFAULT_VIRTUAL_LAYOUT } from '../input/virtual-controls-layout'

const VOLUME_KEY = 'mira_volume_v1'
const LAYOUT_KEY = 'mira_virtual_layout_v1'

export function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return 0.8
    const value = Number(raw)
    if (!Number.isFinite(value)) return 0.8
    return Math.max(0, Math.min(1, value))
  } catch {
    return 0.8
  }
}

export function saveVolume(volume: number): void {
  localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, volume))))
}

export function loadVirtualLayout(): VirtualControlsLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return { ...DEFAULT_VIRTUAL_LAYOUT }
    const parsed = JSON.parse(raw) as Partial<VirtualControlsLayout>
    return { ...DEFAULT_VIRTUAL_LAYOUT, ...parsed }
  } catch {
    return { ...DEFAULT_VIRTUAL_LAYOUT }
  }
}

export function saveVirtualLayout(layout: VirtualControlsLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}
