import { absorbPelletsForEntity } from './collision'
import {
  AVATAR_FARM_MASS_THRESHOLD,
  AVATAR_INCUBATE_SEC,
  AVATAR_RANCH_MASS_THRESHOLD,
  AVATAR_SPAWN_INVINCIBLE_SEC,
  AVATAR_SPAWN_OFFSET,
  FARM_PELLET_COUNT,
  FARM_PELLET_INTERVAL_SEC,
  FARM_PELLET_RING_RADIUS,
  RANCH_ALLY_INTERVAL_SEC,
  RANCH_SPAWN_RING_RADIUS,
} from './avatar-config'
import { clampEntityToWorld, createCircle, isActive, type CircleEntity } from './entity'
import { speedForMass } from './movement'
import { createPellet, type Pellet } from './pellet'
import { PLAYER_START_MASS } from './physics'
import { AI_ROSTER, PLAYER_ROSTER } from './roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

let allyNameIndex = 0

export function resetAvatarState(): void {
  allyNameIndex = 0
}

export function getControlledEntity(
  entities: CircleEntity[],
  controlledId: number,
): CircleEntity | null {
  return entities.find((e) => e.id === controlledId && e.isPlayer && isActive(e)) ?? null
}

export function canBeginAvatarTransform(
  entity: CircleEntity | null,
  kind: 'farm' | 'ranch',
): boolean {
  if (!entity || !entity.isPlayer || !isActive(entity)) return false
  if (entity.isFrozen || entity.avatarIncubateTimer > 0) return false
  const threshold =
    kind === 'farm' ? AVATAR_FARM_MASS_THRESHOLD : AVATAR_RANCH_MASS_THRESHOLD
  return entity.mass >= threshold
}

export function beginAvatarTransform(entity: CircleEntity, kind: 'farm' | 'ranch'): void {
  entity.isFrozen = true
  entity.impulseX = 0
  entity.impulseY = 0
  entity.avatarIncubateTimer = AVATAR_INCUBATE_SEC
  entity.invincibleTimer = AVATAR_INCUBATE_SEC
  entity.pendingAvatarKind = kind
}

function spawnOffset(kind: 'farm' | 'ranch'): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2
  const dist = AVATAR_SPAWN_OFFSET + (kind === 'ranch' ? 20 : 0)
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }
}

export interface IncubationResult {
  entities: CircleEntity[]
  newControlledId: number | null
}

export function updateAvatarIncubation(
  entities: CircleEntity[],
  controlledId: number,
  dt: number,
): IncubationResult {
  let newControlledId: number | null = null
  const next = [...entities]

  for (const entity of next) {
    if (entity.avatarIncubateTimer <= 0) continue
    entity.avatarIncubateTimer = Math.max(0, entity.avatarIncubateTimer - dt)
    if (entity.avatarIncubateTimer > 0) continue

    const kind = entity.pendingAvatarKind
    if (kind === 'none') continue

    const offset = spawnOffset(kind)
    const child = createCircle(
      entity.x + offset.x,
      entity.y + offset.y,
      PLAYER_START_MASS,
      entity.isPlayer,
      PLAYER_ROSTER,
    )
    child.invincibleTimer = AVATAR_SPAWN_INVINCIBLE_SEC
    clampEntityToWorld(child, WORLD_WIDTH, WORLD_HEIGHT)
    next.push(child)

    if (entity.isPlayer && entity.id === controlledId) {
      entity.isPlayer = false
      entity.avatarRole = kind
      entity.isFrozen = true
      entity.pelletSpawnTimer = kind === 'farm' ? FARM_PELLET_INTERVAL_SEC : 0
      entity.allySpawnTimer = kind === 'ranch' ? RANCH_ALLY_INTERVAL_SEC : 0
      entity.name = kind === 'farm' ? '农场' : '牧场'
      newControlledId = child.id
    } else if (entity.avatarRole === 'ally') {
      entity.avatarRole = kind
      entity.isFrozen = true
      entity.pelletSpawnTimer = kind === 'farm' ? FARM_PELLET_INTERVAL_SEC : 0
      entity.allySpawnTimer = kind === 'ranch' ? RANCH_ALLY_INTERVAL_SEC : 0
      entity.name = kind === 'farm' ? '农场' : '牧场'
    }

    entity.pendingAvatarKind = 'none'
  }

  return { entities: next, newControlledId }
}

export function spawnPelletsAroundFarm(
  farm: CircleEntity,
  pellets: Pellet[],
): Pellet[] {
  const spawned: Pellet[] = []
  for (let i = 0; i < FARM_PELLET_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / FARM_PELLET_COUNT + Math.random() * 0.25
    const r = FARM_PELLET_RING_RADIUS + Math.random() * 35
    const pellet = createPellet(farm.x + Math.cos(angle) * r, farm.y + Math.sin(angle) * r)
    spawned.push(pellet)
  }
  return [...pellets, ...spawned]
}

export function updateFarmStructures(
  entities: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): Pellet[] {
  let nextPellets = pellets
  for (const entity of entities) {
    if (entity.avatarRole !== 'farm' || !entity.isFrozen) continue
    entity.pelletSpawnTimer -= dt
    if (entity.pelletSpawnTimer > 0) continue
    entity.pelletSpawnTimer = FARM_PELLET_INTERVAL_SEC
    nextPellets = spawnPelletsAroundFarm(entity, nextPellets)
  }
  return nextPellets
}

export function spawnRanchAlly(entities: CircleEntity[], ranch: CircleEntity): CircleEntity[] {
  const angle = Math.random() * Math.PI * 2
  const x = ranch.x + Math.cos(angle) * RANCH_SPAWN_RING_RADIUS
  const y = ranch.y + Math.sin(angle) * RANCH_SPAWN_RING_RADIUS
  const roster = AI_ROSTER[allyNameIndex % AI_ROSTER.length]
  allyNameIndex++
  const ally = createCircle(x, y, PLAYER_START_MASS, false, roster)
  ally.avatarRole = 'ally'
  ally.name = `${roster.name}·后`
  clampEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
  return [...entities, ally]
}

export function updateRanchStructures(
  entities: CircleEntity[],
  dt: number,
): CircleEntity[] {
  let next = entities
  for (const entity of entities) {
    if (entity.avatarRole !== 'ranch' || !entity.isFrozen) continue
    entity.allySpawnTimer -= dt
    if (entity.allySpawnTimer > 0) continue
    entity.allySpawnTimer = RANCH_ALLY_INTERVAL_SEC
    next = spawnRanchAlly(next, entity)
  }
  return next
}

export function updateAlly(
  ally: CircleEntity,
  pellets: Pellet[],
  dt: number,
): { pellets: Pellet[]; absorbed: Pellet[] } {
  if (!isActive(ally) || ally.isFrozen || ally.avatarIncubateTimer > 0) {
    return { pellets, absorbed: [] }
  }

  let nearest: Pellet | null = null
  let nearestDist = Infinity
  for (const pellet of pellets) {
    const dist = Math.hypot(pellet.x - ally.x, pellet.y - ally.y)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = pellet
    }
  }

  if (nearest) {
    const dx = nearest.x - ally.x
    const dy = nearest.y - ally.y
    const dist = Math.hypot(dx, dy)
    if (dist > 1) {
      const speed = speedForMass(ally.mass)
      ally.x += (dx / dist) * speed * dt
      ally.y += (dy / dist) * speed * dt
      clampEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
    }
  }

  const absorbed = absorbPelletsForEntity(ally, pellets)
  const absorbedIds = new Set(absorbed.map((p) => p.id))
  const nextPellets = pellets.filter((p) => !absorbedIds.has(p.id))

  if (
    ally.mass >= AVATAR_FARM_MASS_THRESHOLD &&
    ally.avatarIncubateTimer <= 0 &&
    !ally.isFrozen
  ) {
    const kind: 'farm' | 'ranch' = Math.random() < 0.5 ? 'farm' : 'ranch'
    beginAvatarTransform(ally, kind)
  }

  return { pellets: nextPellets, absorbed }
}

export function applyFrozenMovement(entity: CircleEntity, moveX: number, moveY: number, dt: number): void {
  if (entity.isFrozen || entity.avatarIncubateTimer > 0) return
  const len = Math.hypot(moveX, moveY)
  if (len < 0.1) return
  const speed = speedForMass(entity.mass)
  entity.x += (moveX / len) * speed * dt
  entity.y += (moveY / len) * speed * dt
  clampEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

export function countTribeStructures(entities: CircleEntity[]): { farms: number; ranches: number; allies: number } {
  let farms = 0
  let ranches = 0
  let allies = 0
  for (const e of entities) {
    if (e.avatarRole === 'farm') farms++
    if (e.avatarRole === 'ranch') ranches++
    if (e.avatarRole === 'ally' && isActive(e) && !e.isFrozen) allies++
  }
  return { farms, ranches, allies }
}
