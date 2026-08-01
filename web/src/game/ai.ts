import { createCircle, type CircleEntity } from './entity'
import { clampEntityToWorld, entityRadius } from './entity'
import { absorbPelletsForEntity } from './collision'
import type { Pellet } from './pellet'
import { PLAYER_START_MASS, PLAYER_START_RADIUS, radiusToMass } from './physics'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const AI_COUNT = 7
const AI_SPEED = 220
const VISION_FACTOR = 10

export function spawnAiEntities(
  playerX: number,
  playerY: number,
  avoidRadius: number,
): CircleEntity[] {
  const ais: CircleEntity[] = []
  let attempts = 0

  while (ais.length < AI_COUNT && attempts < 200) {
    attempts++
    const x = 80 + Math.random() * (WORLD_WIDTH - 160)
    const y = 80 + Math.random() * (WORLD_HEIGHT - 160)
    if (Math.hypot(x - playerX, y - playerY) < avoidRadius) continue

    const mass = radiusToMass(PLAYER_START_RADIUS * (0.55 + Math.random() * 0.7))
    ais.push(createCircle(x, y, mass, false, 8 + Math.random() * 35))
  }

  return ais
}

export function updateAi(
  ai: CircleEntity,
  player: CircleEntity,
  peers: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): Pellet[] {
  const vision = entityRadius(ai) * VISION_FACTOR
  let dirX = 0
  let dirY = 0

  const threats = [player, ...peers].filter((other) => {
    if (other.id === ai.id) return false
    if (other.mass <= ai.mass * 1.05) return false
    return Math.hypot(other.x - ai.x, other.y - ai.y) < vision
  })

  const prey = [player, ...peers].find((other) => {
    if (other.id === ai.id) return false
    if (other.mass >= ai.mass * 0.85) return false
    const dist = Math.hypot(other.x - ai.x, other.y - ai.y)
    return dist < vision * 0.9
  })

  const nearestPellet = findNearestPellet(ai, pellets, vision)

  if (threats.length > 0) {
    const threat = threats.reduce((best, t) => {
      const d = Math.hypot(t.x - ai.x, t.y - ai.y)
      return !best || d < best.dist ? { entity: t, dist: d } : best
    }, null as { entity: CircleEntity; dist: number } | null)
    if (threat) {
      dirX = ai.x - threat.entity.x
      dirY = ai.y - threat.entity.y
    }
  } else if (prey) {
    dirX = prey.x - ai.x
    dirY = prey.y - ai.y
  } else if (nearestPellet) {
    dirX = nearestPellet.x - ai.x
    dirY = nearestPellet.y - ai.y
  } else {
    ai.wanderTimer -= dt
    if (ai.wanderTimer <= 0) {
      ai.wanderAngle = Math.random() * Math.PI * 2
      ai.wanderTimer = 1.2 + Math.random() * 2.5
    }
    dirX = Math.cos(ai.wanderAngle)
    dirY = Math.sin(ai.wanderAngle)
  }

  const len = Math.hypot(dirX, dirY)
  if (len > 0.01) {
    const speed = AI_SPEED * (PLAYER_START_MASS / ai.mass) ** 0.1
    ai.x += (dirX / len) * speed * dt
    ai.y += (dirY / len) * speed * dt
  }

  clampEntityToWorld(ai, WORLD_WIDTH, WORLD_HEIGHT)
  return absorbPelletsForEntity(ai, pellets)
}

function findNearestPellet(
  ai: CircleEntity,
  pellets: Pellet[],
  vision: number,
): Pellet | null {
  let best: Pellet | null = null
  let bestDist = vision
  for (const pellet of pellets) {
    const dist = Math.hypot(pellet.x - ai.x, pellet.y - ai.y)
    if (dist < bestDist) {
      bestDist = dist
      best = pellet
    }
  }
  return best
}
