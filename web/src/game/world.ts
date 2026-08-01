import { createPellet, type Pellet, spawnPellets } from './pellet'

export const WORLD_WIDTH = 2400
export const WORLD_HEIGHT = 1600

const TARGET_PELLET_COUNT = 100
const SPAWN_MARGIN = 28
const MIN_SPAWN_DIST = 80

export class GameWorld {
  pellets: Pellet[] = []

  reset(playerX: number, playerY: number): void {
    this.pellets = spawnPellets(TARGET_PELLET_COUNT, WORLD_WIDTH, WORLD_HEIGHT, SPAWN_MARGIN)
    this.ensureSpacing(playerX, playerY, 120)
  }

  maintainPopulation(playerX: number, playerY: number): void {
    while (this.pellets.length < TARGET_PELLET_COUNT) {
      const pellet = createPellet(
        SPAWN_MARGIN + Math.random() * (WORLD_WIDTH - SPAWN_MARGIN * 2),
        SPAWN_MARGIN + Math.random() * (WORLD_HEIGHT - SPAWN_MARGIN * 2),
      )
      const dx = pellet.x - playerX
      const dy = pellet.y - playerY
      if (Math.hypot(dx, dy) < MIN_SPAWN_DIST) continue
      this.pellets.push(pellet)
    }
  }

  removePellet(id: number): void {
    this.pellets = this.pellets.filter((p) => p.id !== id)
  }

  private ensureSpacing(anchorX: number, anchorY: number, minDist: number): void {
    for (const pellet of this.pellets) {
      const dx = pellet.x - anchorX
      const dy = pellet.y - anchorY
      const dist = Math.hypot(dx, dy)
      if (dist >= minDist || dist === 0) continue
      const angle = Math.atan2(dy, dx)
      pellet.x = anchorX + Math.cos(angle) * minDist
      pellet.y = anchorY + Math.sin(angle) * minDist
      pellet.x = clamp(pellet.x, SPAWN_MARGIN, WORLD_WIDTH - SPAWN_MARGIN)
      pellet.y = clamp(pellet.y, SPAWN_MARGIN, WORLD_HEIGHT - SPAWN_MARGIN)
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
