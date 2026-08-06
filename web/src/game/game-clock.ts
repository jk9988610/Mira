export function formatGameTime(totalSec: number): string {
  const sec = Math.max(0, totalSec)
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor((sec % 3600) / 60)
  const sWhole = Math.floor(sec % 60)
  const sFrac = Math.floor((sec % 1) * 10)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sWhole.toString().padStart(2, '0')}.${sFrac}`
}
