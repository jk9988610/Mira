import { avatarChildRadius, avatarEntityRadius } from './avatar-radius'
import { canAbsorbPellet, createPellet, type Pellet } from './pellet'
import { addMassLogarithmic, massToRadius, PLAYER_START_MASS } from './physics'
import type { CircleEntity } from './entity'
import { clampEntityToWorld, createCircle, isActive } from './entity'
import {
  AVATAR_SPAWN_OFFSET,
  FARM_BUILD_COST,
  FARM_NEARBY_PELLET_CAP,
  FARM_PELLET_COUNT,
  FARM_PELLET_INTERVAL_SEC,
  FARM_PELLET_RING_RADIUS,
  FARM_PELLET_SENSE_RADIUS,
  FARM_STRUCTURE_MASS,
  RANCH_ALLY_INTERVAL_SEC,
  RANCH_BUILD_COST,
  RANCH_STRUCTURE_MASS,
  SPAWN_CLEARANCE,
} from './avatar-config'
import { speedForMass } from './movement'
import { AI_ROSTER, PLAYER_ROSTER } from './roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

let allyNameIndex = 0

export function resetAvatarState(): void {
  allyNameIndex = 0
}

export { avatarEntityRadius } from './avatar-radius'

export function getControlledEntity(
  entities: CircleEntity[],
  controlledId: number,
): CircleEntity | null {
  return entities.find((e) => e.id === controlledId && e.isPlayer && isActive(e)) ?? null
}

function buildCost(kind: 'farm' | 'ranch'): number {
  return kind === 'farm' ? FARM_BUILD_COST : RANCH_BUILD_COST
}

function structureMass(kind: 'farm' | 'ranch'): number {
  return kind === 'farm' ? FARM_STRUCTURE_MASS : RANCH_STRUCTURE_MASS
}

function structureLabel(kind: 'farm' | 'ranch', builderName: string): string {
  return kind === 'farm' ? `${builderName}的农场` : `${builderName}的牧场`
}

export function countFarms(entities: CircleEntity[]): number {
  return entities.filter((e) => e.avatarRole === 'farm').length
}

export function countRanches(entities: CircleEntity[]): number {
  return entities.filter((e) => e.avatarRole === 'ranch').length
}

/** 牧场×10 < 农场数 → 停建农场（AI 与玩家共用） */
export function canBuildMoreFarms(entities: CircleEntity[]): boolean {
  return countRanches(entities) * 10 >= countFarms(entities)
}

/** 牧场×10 < 世界圆总数 → 牧场停止生成后代 */
export function canRanchSpawnAlly(entities: CircleEntity[]): boolean {
  return countRanches(entities) * 10 >= entities.length
}

function structureRadius(kind: 'farm' | 'ranch'): number {
  return massToRadius(structureMass(kind))
}

function isAvatarStructure(entity: CircleEntity): boolean {
  return entity.avatarRole === 'farm' || entity.avatarRole === 'ranch'
}

/** 在 (x,y) 放置指定建筑是否会与现有农场/牧场重叠 */
export function wouldOverlapStructures(
  x: number,
  y: number,
  radius: number,
  entities: CircleEntity[],
  ignoreId: number,
): boolean {
  for (const other of entities) {
    if (other.id === ignoreId || !isAvatarStructure(other)) continue
    const otherR = avatarEntityRadius(other)
    const dist = Math.hypot(other.x - x, other.y - y)
    if (dist < radius + otherR + SPAWN_CLEARANCE) return true
  }
  return false
}

/** 化身后建筑与新生圆是否都有合法位置 */
export function canPlaceAvatarTransform(
  entity: CircleEntity,
  kind: 'farm' | 'ranch',
  entities: CircleEntity[],
): boolean {
  const structureR = structureRadius(kind)
  if (wouldOverlapStructures(entity.x, entity.y, structureR, entities, entity.id)) {
    return false
  }

  const leftover = Math.max(PLAYER_START_MASS, entity.mass - buildCost(kind))
  const childRadius = avatarChildRadius(leftover)
  return hasClearSpawnPosition(entity.x, entity.y, childRadius, entities, entity.id)
}

export function canBeginAvatarTransform(
  entity: CircleEntity | null,
  kind: 'farm' | 'ranch',
  entities: CircleEntity[],
): boolean {
  if (!entity || !isActive(entity)) return false
  if (entity.isFrozen) return false
  if (entity.avatarRole !== 'none' && entity.avatarRole !== 'ally') return false
  if (!entity.isPlayer && entity.avatarRole !== 'ally') return false
  if (entity.mass < buildCost(kind)) return false
  if (kind === 'farm' && !canBuildMoreFarms(entities)) return false
  if (!canPlaceAvatarTransform(entity, kind, entities)) return false
  return true
}

function overlapsOthers(x: number, y: number, radius: number, entities: CircleEntity[], ignoreId: number): boolean {
  for (const other of entities) {
    if (other.id === ignoreId) continue
    const r = avatarEntityRadius(other)
    const dist = Math.hypot(other.x - x, other.y - y)
    if (dist < r + radius + SPAWN_CLEARANCE) return true
  }
  return false
}

export function hasClearSpawnPosition(
  originX: number,
  originY: number,
  radius: number,
  entities: CircleEntity[],
  ignoreId: number,
): boolean {
  for (let ring = 0; ring < 4; ring++) {
    const dist = AVATAR_SPAWN_OFFSET + ring * 55
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + ring * 0.4
      const x = originX + Math.cos(angle) * dist
      const y = originY + Math.sin(angle) * dist
      if (!overlapsOthers(x, y, radius, entities, ignoreId)) return true
    }
  }
  return false
}

export function findClearSpawnPosition(
  originX: number,
  originY: number,
  radius: number,
  entities: CircleEntity[],
  ignoreId: number,
): { x: number; y: number } | null {
  for (let ring = 0; ring < 4; ring++) {
    const dist = AVATAR_SPAWN_OFFSET + ring * 55
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + ring * 0.4
      const x = originX + Math.cos(angle) * dist
      const y = originY + Math.sin(angle) * dist
      if (!overlapsOthers(x, y, radius, entities, ignoreId)) {
        return { x, y }
      }
    }
  }
  return null
}

export function findNearestAvatarTransformSpot(
  entity: CircleEntity,
  kind: 'farm' | 'ranch',
  entities: CircleEntity[],
): { x: number; y: number } | null {
  const structureR = structureRadius(kind)
  const leftover = Math.max(PLAYER_START_MASS, entity.mass - buildCost(kind))
  const childRadius = avatarChildRadius(leftover)

  const isValidSpot = (x: number, y: number): boolean => {
    if (x < structureR || y < structureR || x > WORLD_WIDTH - structureR || y > WORLD_HEIGHT - structureR) {
      return false
    }
    if (wouldOverlapStructures(x, y, structureR, entities, entity.id)) return false
    return hasClearSpawnPosition(x, y, childRadius, entities, entity.id)
  }

  if (isValidSpot(entity.x, entity.y)) {
    return { x: entity.x, y: entity.y }
  }

  const step = 60
  const maxRings = 30
  for (let ring = 1; ring <= maxRings; ring++) {
    const dist = ring * step
    const samples = Math.max(16, ring * 4)
    let best: { x: number; y: number; d: number } | null = null
    for (let i = 0; i < samples; i++) {
      const angle = (Math.PI * 2 * i) / samples
      const x = entity.x + Math.cos(angle) * dist
      const y = entity.y + Math.sin(angle) * dist
      if (!isValidSpot(x, y)) continue
      const d = Math.hypot(x - entity.x, y - entity.y)
      if (!best || d < best.d) best = { x, y, d }
    }
    if (best) return { x: best.x, y: best.y }
  }
  return null
}

function moveEntityToward(entity: CircleEntity, targetX: number, targetY: number, dt: number): void {
  const dx = targetX - entity.x
  const dy = targetY - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist <= 1) return
  const speed = speedForMass(entity.mass)
  entity.x += (dx / dist) * speed * dt
  entity.y += (dy / dist) * speed * dt
  clampEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

function tryAllyFarmTransform(
  ally: CircleEntity,
  entities: CircleEntity[],
  pellets: Pellet[],
): { entities: CircleEntity[]; pellets: Pellet[]; absorbed: Pellet[] } {
  if (!canBeginAvatarTransform(ally, 'farm', entities)) {
    return { entities, pellets, absorbed: [] }
  }
  const { pellets: nextPellets, absorbed } = absorbAndFilterPellets(ally, pellets)
  const nextEntities = completeAvatarTransform(entities, ally, 'farm', -1).entities
  return { entities: nextEntities, pellets: nextPellets, absorbed }
}

function absorbAndFilterPellets(
  entity: CircleEntity,
  pellets: Pellet[],
): { pellets: Pellet[]; absorbed: Pellet[] } {
  const absorbed = absorbPelletsForAvatar(entity, pellets)
  if (absorbed.length === 0) return { pellets, absorbed }
  const absorbedIds = new Set(absorbed.map((p) => p.id))
  return { pellets: pellets.filter((p) => !absorbedIds.has(p.id)), absorbed }
}

function rosterFromEntity(entity: CircleEntity) {
  return {
    name: entity.builderName || entity.name,
    colorLight: entity.colorLight,
    colorDark: entity.colorDark,
    strokeColor: entity.strokeColor,
  }
}

export interface TransformResult {
  entities: CircleEntity[]
  newControlledId: number | null
}

export function completeAvatarTransform(
  entities: CircleEntity[],
  entity: CircleEntity,
  kind: 'farm' | 'ranch',
  controlledId: number,
): TransformResult {
  if (!canBeginAvatarTransform(entity, kind, entities)) {
    return { entities, newControlledId: null }
  }

  const cost = buildCost(kind)
  entity.builderName = entity.name.replace(/·后$/, '').replace(/的(农场|牧场)$/, '')
  entity.mass -= cost

  const leftover = Math.max(PLAYER_START_MASS, entity.mass)
  const wasPlayer = entity.isPlayer && entity.id === controlledId
  const childRadius = avatarChildRadius(leftover)
  const spawn = findClearSpawnPosition(entity.x, entity.y, childRadius, entities, entity.id)
  if (!spawn) return { entities, newControlledId: null }

  const roster = wasPlayer ? PLAYER_ROSTER : rosterFromEntity(entity)
  const child = createCircle(spawn.x, spawn.y, leftover, wasPlayer, roster)
  if (!wasPlayer) {
    child.avatarRole = 'ally'
    child.name = entity.builderName
    child.builderName = entity.builderName
  }
  clampEntityToWorld(child, WORLD_WIDTH, WORLD_HEIGHT)

  entity.isPlayer = false
  entity.avatarRole = kind
  entity.isFrozen = true
  entity.mass = structureMass(kind)
  entity.name = structureLabel(kind, entity.builderName)
  entity.pelletSpawnTimer = kind === 'farm' ? FARM_PELLET_INTERVAL_SEC : 0
  entity.allySpawnTimer = kind === 'ranch' ? RANCH_ALLY_INTERVAL_SEC : 0
  entity.pendingAvatarKind = 'none'
  entity.avatarIncubateTimer = 0
  entity.invincibleTimer = 0

  return {
    entities: [...entities, child],
    newControlledId: wasPlayer ? child.id : null,
  }
}

export function createStarterStructure(
  x: number,
  y: number,
  kind: 'farm' | 'ranch',
  builderName: string,
): CircleEntity {
  const structure = createCircle(x, y, structureMass(kind), false, PLAYER_ROSTER)
  structure.avatarRole = kind
  structure.isFrozen = true
  structure.mass = structureMass(kind)
  structure.builderName = builderName
  structure.name = structureLabel(kind, builderName)
  structure.pelletSpawnTimer = kind === 'farm' ? FARM_PELLET_INTERVAL_SEC : 0
  structure.allySpawnTimer = kind === 'ranch' ? RANCH_ALLY_INTERVAL_SEC * 0.5 : 0
  return structure
}

export function absorbPelletsForAvatar(entity: CircleEntity, pellets: Pellet[]): Pellet[] {
  if (!isActive(entity) || entity.isFrozen) return []
  const radius = avatarEntityRadius(entity)
  const absorbed: Pellet[] = []
  for (const pellet of pellets) {
    if (!canAbsorbPellet(entity.x, entity.y, radius, pellet)) continue
    entity.mass = addMassLogarithmic(entity.mass, pellet.mass)
    absorbed.push(pellet)
  }
  return absorbed
}

export function countPelletsNearFarm(farm: CircleEntity, pellets: Pellet[]): number {
  let count = 0
  for (const pellet of pellets) {
    if (Math.hypot(pellet.x - farm.x, pellet.y - farm.y) <= FARM_PELLET_SENSE_RADIUS) count++
  }
  return count
}

export function spawnPelletsAroundFarm(farm: CircleEntity, pellets: Pellet[]): Pellet[] {
  const spawned: Pellet[] = []
  for (let i = 0; i < FARM_PELLET_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / FARM_PELLET_COUNT + Math.random() * 0.25
    const r = FARM_PELLET_RING_RADIUS + Math.random() * 35
    spawned.push(createPellet(farm.x + Math.cos(angle) * r, farm.y + Math.sin(angle) * r))
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
    if (countPelletsNearFarm(entity, nextPellets) >= FARM_NEARBY_PELLET_CAP) continue
    nextPellets = spawnPelletsAroundFarm(entity, nextPellets)
  }
  return nextPellets
}

export function spawnRanchAlly(entities: CircleEntity[], ranch: CircleEntity): CircleEntity[] {
  const childRadius = avatarChildRadius(PLAYER_START_MASS)
  const spawn = findClearSpawnPosition(ranch.x, ranch.y, childRadius, entities, ranch.id)
  if (!spawn) return entities
  const roster = AI_ROSTER[allyNameIndex % AI_ROSTER.length]
  allyNameIndex++
  const ally = createCircle(spawn.x, spawn.y, PLAYER_START_MASS, false, roster)
  ally.avatarRole = 'ally'
  ally.name = roster.name
  ally.builderName = roster.name
  clampEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
  return [...entities, ally]
}

export function updateRanchStructures(entities: CircleEntity[], dt: number): CircleEntity[] {
  let next = entities
  for (const entity of entities) {
    if (entity.avatarRole !== 'ranch' || !entity.isFrozen) continue
    entity.allySpawnTimer -= dt
    if (entity.allySpawnTimer > 0) continue
    entity.allySpawnTimer = RANCH_ALLY_INTERVAL_SEC
    if (!canRanchSpawnAlly(next)) continue
    next = spawnRanchAlly(next, entity)
  }
  return next
}

export function updateAlly(
  ally: CircleEntity,
  entities: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): { pellets: Pellet[]; absorbed: Pellet[]; entities: CircleEntity[] } {
  if (!isActive(ally) || ally.isFrozen) {
    return { pellets, absorbed: [], entities }
  }

  const prioritizeFarmTransform =
    ally.mass >= FARM_BUILD_COST && canBuildMoreFarms(entities)

  if (prioritizeFarmTransform) {
    const immediate = tryAllyFarmTransform(ally, entities, pellets)
    if (immediate.entities !== entities) {
      return { pellets: immediate.pellets, absorbed: immediate.absorbed, entities: immediate.entities }
    }

    const spot = findNearestAvatarTransformSpot(ally, 'farm', entities)
    if (spot) {
      moveEntityToward(ally, spot.x, spot.y, dt)
      const { pellets: movedPellets, absorbed: movedAbsorbed } = absorbAndFilterPellets(ally, pellets)
      const afterMove = tryAllyFarmTransform(ally, entities, movedPellets)
      return {
        pellets: afterMove.pellets,
        absorbed: [...movedAbsorbed, ...afterMove.absorbed],
        entities: afterMove.entities,
      }
    }
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
    moveEntityToward(ally, nearest.x, nearest.y, dt)
  }

  const { pellets: nextPellets, absorbed } = absorbAndFilterPellets(ally, pellets)
  if (prioritizeFarmTransform) {
    const afterEat = tryAllyFarmTransform(ally, entities, nextPellets)
    return { pellets: afterEat.pellets, absorbed: [...absorbed, ...afterEat.absorbed], entities: afterEat.entities }
  }

  return { pellets: nextPellets, absorbed, entities }
}

export function applyFrozenMovement(entity: CircleEntity, moveX: number, moveY: number, dt: number): void {
  if (entity.isFrozen) return
  const len = Math.hypot(moveX, moveY)
  if (len < 0.1) return
  const speed = speedForMass(entity.mass)
  entity.x += (moveX / len) * speed * dt
  entity.y += (moveY / len) * speed * dt
  clampEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

export function getAvatarTransformHints(
  entity: CircleEntity | null,
  entities: CircleEntity[],
): { farm: string; ranch: string } {
  if (!entity) {
    return { farm: 'Q 农场(未就绪)', ranch: 'E 牧场(未就绪)' }
  }

  const farmMassOk = entity.mass >= FARM_BUILD_COST && canBuildMoreFarms(entities)
  const ranchMassOk = entity.mass >= RANCH_BUILD_COST
  const farmPlaceOk = farmMassOk && canPlaceAvatarTransform(entity, 'farm', entities)
  const ranchPlaceOk = ranchMassOk && canPlaceAvatarTransform(entity, 'ranch', entities)

  let farm = 'Q 农场(未就绪)'
  if (farmMassOk && farmPlaceOk) farm = 'Q 化身农场'
  else if (farmMassOk && !canBuildMoreFarms(entities)) farm = 'Q 农场(数量上限)'
  else if (farmMassOk) farm = 'Q 农场(位置被占)'

  let ranch = 'E 牧场(质量不足)'
  if (ranchMassOk && ranchPlaceOk) ranch = 'E 化身牧场'
  else if (ranchMassOk) ranch = 'E 牧场(位置被占)'

  return { farm, ranch }
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
