import { createCircle, type CircleEntity } from './entity'
import { clampEntityToWorld, entityRadius, isActive, isInvincible } from './entity'
import { absorbPelletsForEntity } from './collision'
import { AI_COUNT } from './match-config'
import { speedForMass } from './movement'
import { canSwallowCircle, getHumanTotalMass, getLargestHuman } from './player-team'
import type { Pellet } from './pellet'
import { massToRadius, PLAYER_START_MASS } from './physics'
import { AI_ROSTER } from './roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const VISION_FACTOR = 11
const WALL_MARGIN = 140

export function spawnAiEntities(existing: CircleEntity[]): CircleEntity[] {
  const ais: CircleEntity[] = []
  let attempts = 0

  while (ais.length < AI_COUNT && attempts < 800) {
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
      const minDist = entityRadius(e) + massToRadius(PLAYER_START_MASS) + 40
      return Math.hypot(e.x - x, e.y - y) >= minDist
    })
    if (ok) return { x, y }
  }
  return {
    x: margin + Math.random() * (WORLD_WIDTH - margin * 2),
    y: margin + Math.random() * (WORLD_HEIGHT - margin * 2),
  }
}

export function updateAi(
  ai: CircleEntity,
  allPlayers: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): Pellet[] {
  if (!isActive(ai)) return []

  const humanBlob = getLargestHuman(allPlayers)
  const humanMass = getHumanTotalMass(allPlayers)
  const peers = allPlayers.filter((p) => !p.isPlayer && p.id !== ai.id)
  const vision = entityRadius(ai) * VISION_FACTOR
  let dirX = 0
  let dirY = 0

  const threats = peers.filter((other) => {
    if (!isActive(other) || other.mass <= ai.mass * 1.08) return false
    return Math.hypot(other.x - ai.x, other.y - ai.y) < vision
  })

  if (humanBlob && isActive(humanBlob) && humanMass > ai.mass * 1.12) {
    const d = Math.hypot(humanBlob.x - ai.x, humanBlob.y - ai.y)
    if (d < vision * 1.1) threats.push(humanBlob)
  }

  let prey: CircleEntity | null = null
  let preyScore = -Infinity

  const candidates = [...peers]
  if (humanBlob && isActive(humanBlob) && !isInvincible(humanBlob)) {
    candidates.push(humanBlob)
  }

  for (const other of candidates) {
    if (!isActive(other) || isInvincible(other)) continue
    if (other.mass >= ai.mass * 0.9) continue
    const dist = Math.hypot(other.x - ai.x, other.y - ai.y)
    if (dist > vision) continue
    const score = other.mass / (dist + 40)
    if (score > preyScore) {
      preyScore = score
      prey = other
    }
  }

  const pellet = findBestPellet(ai, pellets, vision)
  const wall = wallAvoidance(ai)

  if (threats.length > 0) {
    const threat = threats.reduce((best, t) => {
      const d = Math.hypot(t.x - ai.x, t.y - ai.y)
      return !best || d < best.dist ? { entity: t, dist: d } : best
    }, null as { entity: CircleEntity; dist: number } | null)
    if (threat) {
      dirX = ai.x - threat.entity.x
      dirY = ai.y - threat.entity.y
    }
  } else if (prey && canSwallowCircle(ai.mass, prey.mass, Math.hypot(prey.x - ai.x, prey.y - ai.y))) {
    dirX = prey.x - ai.x
    dirY = prey.y - ai.y
  } else if (pellet) {
    dirX = pellet.x - ai.x
    dirY = pellet.y - ai.y
  } else {
    ai.wanderTimer -= dt
    if (ai.wanderTimer <= 0) {
      ai.wanderAngle = Math.random() * Math.PI * 2
      ai.wanderTimer = 1.4 + Math.random() * 2.8
    }
    dirX = Math.cos(ai.wanderAngle)
    dirY = Math.sin(ai.wanderAngle)
  }

  dirX += wall.x * 2.2
  dirY += wall.y * 2.2

  const len = Math.hypot(dirX, dirY)
  if (len > 0.01) {
    const speed = speedForMass(ai.mass)
    ai.x += (dirX / len) * speed * dt
    ai.y += (dirY / len) * speed * dt
  }

  clampEntityToWorld(ai, WORLD_WIDTH, WORLD_HEIGHT)
  return absorbPelletsForEntity(ai, pellets)
}

function findBestPellet(ai: CircleEntity, pellets: Pellet[], vision: number): Pellet | null {
  let best: Pellet | null = null
  let bestScore = -Infinity
  for (const pellet of pellets) {
    const dist = Math.hypot(pellet.x - ai.x, pellet.y - ai.y)
    if (dist > vision) continue
    const score = pellet.mass / (dist + 20)
    if (score > bestScore) {
      bestScore = score
      best = pellet
    }
  }
  return best
}

function wallAvoidance(ai: CircleEntity): { x: number; y: number } {
  const r = entityRadius(ai)
  let x = 0
  let y = 0
  if (ai.x < WALL_MARGIN + r) x += 1
  if (ai.x > WORLD_WIDTH - WALL_MARGIN - r) x -= 1
  if (ai.y < WALL_MARGIN + r) y += 1
  if (ai.y > WORLD_HEIGHT - WALL_MARGIN - r) y -= 1
  return { x, y }
}
