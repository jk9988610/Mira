const VOLUME_KEY = 'mira_volume_v1'

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
