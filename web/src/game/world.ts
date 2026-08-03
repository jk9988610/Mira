import { removePelletsByIds } from './pellet-util'
import { massToRadius, PLAYER_START_MASS } from './physics'
import { createPellet, type Pellet, spawnPellets } from './pellet'

/** 参考 16:9 屏幕在默认缩放下可见的一屏世界尺寸 */
const VIEW_FILL = 0.48
const REF_SCREEN_W = 1280
const REF_SCREEN_H = 720
const BASE_VIEW_RADIUS = massToRadius(PLAYER_START_MASS) * 3.2
const REF_RENDER_SCALE = (Math.min(REF_SCREEN_W, REF_SCREEN_H) * VIEW_FILL) / BASE_VIEW_RADIUS
const WORLD_SCALE = 4

export const WORLD_WIDTH = Math.round((REF_SCREEN_W / REF_RENDER_SCALE) * WORLD_SCALE)
export const WORLD_HEIGHT = Math.round((REF_SCREEN_H / REF_RENDER_SCALE) * WORLD_SCALE)

const TARGET_PELLET_COUNT = 480
const SPAWN_MARGIN = 48
const MIN_SPAWN_DIST = massToRadius(PLAYER_START_MASS) + 48

export class GameWorld {
  pellets: Pellet[] = []

  reset(anchorX: number, anchorY: number): void {
    this.pellets = spawnPellets(TARGET_PELLET_COUNT, WORLD_WIDTH, WORLD_HEIGHT, SPAWN_MARGIN)
    this.ensureSpacing(anchorX, anchorY, MIN_SPAWN_DIST)
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
    removePelletsByIds(this.pellets, new Set([id]))
  }

  removePellets(ids: Set<number>): void {
    removePelletsByIds(this.pellets, ids)
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
