import type { VirtualControlsLayout } from '../input/virtual-controls-layout'
import { DEFAULT_VIRTUAL_LAYOUT, normalizeVirtualLayout } from '../input/virtual-controls-layout'

const VOLUME_KEY = 'mira_volume_v1'
const LAYOUT_KEY = 'mira_virtual_layout_v3'

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
    if (!raw) {
      const legacy = localStorage.getItem('mira_virtual_layout_v2')
      if (legacy) return normalizeVirtualLayout(JSON.parse(legacy) as Partial<VirtualControlsLayout>)
      return { ...DEFAULT_VIRTUAL_LAYOUT }
    }
    return normalizeVirtualLayout(JSON.parse(raw) as Partial<VirtualControlsLayout>)
  } catch {
    return { ...DEFAULT_VIRTUAL_LAYOUT }
  }
}

export function saveVirtualLayout(layout: VirtualControlsLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(normalizeVirtualLayout(layout)))
}
