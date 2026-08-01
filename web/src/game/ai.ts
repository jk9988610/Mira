import { createCircle, type CircleEntity } from './entity'
import { clampEntityToWorld, entityRadius, isActive, isInvincible } from './entity'
import { absorbPelletsForEntity } from './collision'
import { AI_COUNT } from './match-config'
import type { Pellet } from './pellet'
import { PLAYER_START_MASS } from './physics'
import { AI_ROSTER } from './roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const AI_SPEED = 220
const VISION_FACTOR = 10

export function spawnAiEntities(existing: CircleEntity[]): CircleEntity[] {
  const ais: CircleEntity[] = []
  let attempts = 0

  while (ais.length < AI_COUNT && attempts < 400) {
    attempts++
    const pos = randomSpawnPosition(existing, ais)
    if (!pos) continue
    const roster = AI_ROSTER[ais.length % AI_ROSTER.length]
    ais.push(createCircle(pos.x, pos.y, PLAYER_START_MASS, false, roster))
  }

  return ais
}

export function randomSpawnPosition(
  existing: CircleEntity[],
  pending: CircleEntity[] = [],
): { x: number; y: number } | null {
  const margin = 120
  for (let i = 0; i < 40; i++) {
    const x = margin + Math.random() * (WORLD_WIDTH - margin * 2)
    const y = margin + Math.random() * (WORLD_HEIGHT - margin * 2)
    const all = [...existing, ...pending]
    const ok = all.every((e) => {
      if (!isActive(e)) return true
      const minDist = entityRadius(e) + massToRadiusSafe() + 40
      return Math.hypot(e.x - x, e.y - y) >= minDist
    })
    if (ok) return { x, y }
  }
  return {
    x: margin + Math.random() * (WORLD_WIDTH - margin * 2),
    y: margin + Math.random() * (WORLD_HEIGHT - margin * 2),
  }
}

function massToRadiusSafe(): number {
  return Math.sqrt(PLAYER_START_MASS / (0.12 * Math.PI))
}

export function updateAi(
  ai: CircleEntity,
  allPlayers: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): Pellet[] {
  if (!isActive(ai)) return []

  const player = allPlayers.find((p) => p.isPlayer)!
  const peers = allPlayers.filter((p) => p.id !== ai.id)
  const vision = entityRadius(ai) * VISION_FACTOR
  let dirX = 0
  let dirY = 0

  const threats = [player, ...peers].filter((other) => {
    if (other.id === ai.id || !isActive(other)) return false
    if (other.mass <= ai.mass * 1.05) return false
    return Math.hypot(other.x - ai.x, other.y - ai.y) < vision
  })

  const prey = [player, ...peers].find((other) => {
    if (other.id === ai.id || !isActive(other) || isInvincible(other)) return false
    if (other.mass >= ai.mass * 0.85) return false
    return Math.hypot(other.x - ai.x, other.y - ai.y) < vision * 0.9
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

function findNearestPellet(ai: CircleEntity, pellets: Pellet[], vision: number): Pellet | null {
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
