import type { Pellet } from './pellet'

/** 颗粒空间网格，用于加速邻近查询 */
export class PelletGrid {
  private readonly cellSize: number
  private buckets = new Map<number, Pellet[]>()

  constructor(cellSize = 128) {
    this.cellSize = cellSize
  }

  rebuild(pellets: Pellet[]): void {
    this.buckets.clear()
    for (const pellet of pellets) {
      const cx = Math.floor(pellet.x / this.cellSize)
      const cy = Math.floor(pellet.y / this.cellSize)
      const key = cx * 100003 + cy
      const bucket = this.buckets.get(key)
      if (bucket) bucket.push(pellet)
      else this.buckets.set(key, [pellet])
    }
  }

  forEachInRadius(x: number, y: number, radius: number, fn: (pellet: Pellet) => void): void {
    const r2 = radius * radius
    const minCx = Math.floor((x - radius) / this.cellSize)
    const maxCx = Math.floor((x + radius) / this.cellSize)
    const minCy = Math.floor((y - radius) / this.cellSize)
    const maxCy = Math.floor((y + radius) / this.cellSize)
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.buckets.get(cx * 100003 + cy)
        if (!bucket) continue
        for (const pellet of bucket) {
          const dx = pellet.x - x
          const dy = pellet.y - y
          if (dx * dx + dy * dy <= r2) fn(pellet)
        }
      }
    }
  }

  countInRadius(x: number, y: number, radius: number): number {
    let count = 0
    this.forEachInRadius(x, y, radius, () => {
      count++
    })
    return count
  }

  findNearest(x: number, y: number, maxRadius = Infinity): Pellet | null {
    let nearest: Pellet | null = null
    let nearestDist = maxRadius
    this.forEachInRadius(x, y, maxRadius, (pellet) => {
      const dist = Math.hypot(pellet.x - x, pellet.y - y)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = pellet
      }
    })
    return nearest
  }
}
