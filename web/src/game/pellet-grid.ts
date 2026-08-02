import { WORLD_HEIGHT, WORLD_WIDTH } from './world'
import type { Pellet } from './pellet'

/** 颗粒邻近查询的最大半径（覆盖整张地图对角线） */
const MAX_QUERY_RADIUS = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT)

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
    const safeRadius = Number.isFinite(radius) ? Math.min(radius, MAX_QUERY_RADIUS) : MAX_QUERY_RADIUS
    const r2 = safeRadius * safeRadius
    const minCx = Math.floor((x - safeRadius) / this.cellSize)
    const maxCx = Math.floor((x + safeRadius) / this.cellSize)
    const minCy = Math.floor((y - safeRadius) / this.cellSize)
    const maxCy = Math.floor((y + safeRadius) / this.cellSize)
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

  findNearest(x: number, y: number, maxRadius = MAX_QUERY_RADIUS): Pellet | null {
    let nearest: Pellet | null = null
    let nearestDistSq = maxRadius * maxRadius
    this.forEachInRadius(x, y, maxRadius, (pellet) => {
      const dx = pellet.x - x
      const dy = pellet.y - y
      const distSq = dx * dx + dy * dy
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq
        nearest = pellet
      }
    })
    return nearest
  }
}
