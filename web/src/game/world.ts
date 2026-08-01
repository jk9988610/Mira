import { PLAYER_START_RADIUS } from './physics'
import { createPellet, type Pellet, spawnPellets } from './pellet'

export const WORLD_WIDTH = 5600
export const WORLD_HEIGHT = 3800

const TARGET_PELLET_COUNT = 600
const SPAWN_MARGIN = 40
const MIN_SPAWN_DIST = PLAYER_START_RADIUS + 64

export class GameWorld {
  pellets: Pellet[] = []

  reset(anchorX: number, anchorY: number): void {
    this.pellets = spawnPellets(TARGET_PELLET_COUNT, WORLD_WIDTH, WORLD_HEIGHT, SPAWN_MARGIN)
    this.ensureSpacing(anchorX, anchorY, PLAYER_START_RADIUS + 48)
  }

  maintainPopulation(anchorX: number, anchorY: number): void {
    while (this.pellets.length < TARGET_PELLET_COUNT) {
      const pellet = createPellet(
        SPAWN_MARGIN + Math.random() * (WORLD_WIDTH - SPAWN_MARGIN * 2),
        SPAWN_MARGIN + Math.random() * (WORLD_HEIGHT - SPAWN_MARGIN * 2),
      )
      if (Math.hypot(pellet.x - anchorX, pellet.y - anchorY) < MIN_SPAWN_DIST) continue
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
