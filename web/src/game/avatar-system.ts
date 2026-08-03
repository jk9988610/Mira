import { avatarChildRadius, avatarEntityRadius } from './avatar-radius'
import {
  canAvatarAbsorbPellets,
  initAvatarVitality,
  isAvatarLifeExpired,
  tickAvatarMetabolism,
  updateAbsorptionPause,
} from './avatar-vitality'
import { canAbsorbPellet, createPellet, type Pellet } from './pellet'
import { addMassLogarithmic, massToRadius, PLAYER_START_MASS } from './physics'
import type { CircleEntity } from './entity'
import { clampEntityToWorld, createCircle, isActive } from './entity'
import {
  ALLIES_PER_RANCH,
  AVATAR_SEEK_CACHE_SEC,
  AVATAR_SEEK_FAIL_CACHE_SEC,
  AVATAR_SPAWN_OFFSET,
  AVATAR_MAX_PELLETS,
  FARM_BUILD_COST,
  FARM_NEARBY_PELLET_CAP,
  FARM_PELLET_COUNT,
  FARM_PELLET_CYCLES_BEFORE_REVERT,
  FARM_PELLET_INTERVAL_SEC,
  FARM_PELLET_RING_RADIUS,
  FARM_PELLET_SENSE_RADIUS,
  FARM_STRUCTURE_MASS,
  FARMS_PER_RANCH,
  RANCH_ALLIES_BEFORE_REVERT,
  RANCH_ALLY_INTERVAL_SEC,
  RANCH_BUILD_COST,
  RANCH_STRUCTURE_MASS,
  SPAWN_CLEARANCE,
} from './avatar-config'
import { speedForMass } from './movement'
import type { PelletGrid } from './pellet-grid'
import { removePelletsByIds } from './pellet-util'
import { AI_ROSTER, PLAYER_ROSTER } from './roster'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

let allyNameIndex = 0
type AllySeekCache =
  | { kind: 'farm' | 'ranch'; status: 'hit'; x: number; y: number; expiresAt: number }
  | { kind: 'farm' | 'ranch'; status: 'miss'; expiresAt: number }
const allySeekCache = new Map<number, AllySeekCache>()

export function resetAvatarState(): void {
  allyNameIndex = 0
  allySeekCache.clear()
}

export { avatarEntityRadius } from './avatar-radius'

export function getControlledEntity(
  entities: CircleEntity[],
  controlledId: number,
): CircleEntity | null {
  const direct =
    entities.find((e) => e.id === controlledId && e.isPlayer && isActive(e) && !e.isFrozen) ?? null
  if (direct) return direct
  return entities.find((e) => e.isPlayer && isActive(e) && !e.isFrozen) ?? null
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

/** 可移动的圆：玩家与后代（不含农场/牧场建筑） */
export function countMobileCircles(entities: CircleEntity[]): number {
  let count = 0
  for (const e of entities) {
    if (!isActive(e) || e.isFrozen) continue
    if (e.avatarRole === 'farm' || e.avatarRole === 'ranch') continue
    count++
  }
  return count
}

/** 农场数 < 牧场数×N → 允许建农场 */
export function canBuildMoreFarms(entities: CircleEntity[]): boolean {
  return countFarms(entities) < countRanches(entities) * FARMS_PER_RANCH
}

/** 可移动圆数 < 牧场数×N → 牧场可产后代 */
export function canRanchSpawnAlly(entities: CircleEntity[]): boolean {
  return countMobileCircles(entities) < countRanches(entities) * ALLIES_PER_RANCH
}

export function tickAvatarTransformCooldowns(entities: CircleEntity[], dt: number): void {
  for (const entity of entities) {
    if (entity.avatarTransformCooldown > 0) {
      entity.avatarTransformCooldown = Math.max(0, entity.avatarTransformCooldown - dt)
    }
  }
}

function trimPellets(pellets: Pellet[]): Pellet[] {
  if (pellets.length <= AVATAR_MAX_PELLETS) return pellets
  return pellets.slice(pellets.length - AVATAR_MAX_PELLETS)
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

/** 化身后建筑与自身位置重叠检测（不再生成后代圆） */
export function canPlaceAvatarTransform(
  entity: CircleEntity,
  kind: 'farm' | 'ranch',
  entities: CircleEntity[],
): boolean {
  const structureR = structureRadius(kind)
  return !wouldOverlapStructures(entity.x, entity.y, structureR, entities, entity.id)
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
  if (entity.avatarTransformCooldown > 0) return false
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
  const rings = entities.length > 120 ? 2 : entities.length > 60 ? 3 : 4
  const samples = entities.length > 120 ? 8 : 16
  for (let ring = 0; ring < rings; ring++) {
    const dist = AVATAR_SPAWN_OFFSET + ring * 55
    for (let i = 0; i < samples; i++) {
      const angle = (Math.PI * 2 * i) / samples + ring * 0.4
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
  now = 0,
): { x: number; y: number } | null {
  const cached = allySeekCache.get(entity.id)
  if (cached && cached.kind === kind && cached.expiresAt > now) {
    if (cached.status === 'miss') return null
    return { x: cached.x, y: cached.y }
  }

  const structureR = structureRadius(kind)

  const isValidSpot = (x: number, y: number): boolean => {
    if (x < structureR || y < structureR || x > WORLD_WIDTH - structureR || y > WORLD_HEIGHT - structureR) {
      return false
    }
    return !wouldOverlapStructures(x, y, structureR, entities, entity.id)
  }

  if (isValidSpot(entity.x, entity.y)) {
    allySeekCache.set(entity.id, {
      kind,
      status: 'hit',
      x: entity.x,
      y: entity.y,
      expiresAt: now + AVATAR_SEEK_CACHE_SEC,
    })
    return { x: entity.x, y: entity.y }
  }

  const step = 60
  const maxRings = entities.length > 120 ? 8 : entities.length > 60 ? 12 : 16
  for (let ring = 1; ring <= maxRings; ring++) {
    const dist = ring * step
    const samples = Math.min(16, Math.max(8, ring * 2))
    let best: { x: number; y: number; d: number } | null = null
    for (let i = 0; i < samples; i++) {
      const angle = (Math.PI * 2 * i) / samples
      const x = entity.x + Math.cos(angle) * dist
      const y = entity.y + Math.sin(angle) * dist
      if (!isValidSpot(x, y)) continue
      const d = Math.hypot(x - entity.x, y - entity.y)
      if (!best || d < best.d) best = { x, y, d }
    }
    if (best) {
      allySeekCache.set(entity.id, {
        kind,
        status: 'hit',
        x: best.x,
        y: best.y,
        expiresAt: now + AVATAR_SEEK_CACHE_SEC,
      })
      return { x: best.x, y: best.y }
    }
  }
  allySeekCache.set(entity.id, {
    kind,
    status: 'miss',
    expiresAt: now + AVATAR_SEEK_FAIL_CACHE_SEC,
  })
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

function tryAllyTransform(
  ally: CircleEntity,
  entities: CircleEntity[],
  pellets: Pellet[],
  kind: 'farm' | 'ranch',
): { entities: CircleEntity[]; pellets: Pellet[]; absorbed: Pellet[] } {
  if (!canBeginAvatarTransform(ally, kind, entities)) {
    return { entities, pellets, absorbed: [] }
  }
  const { pellets: nextPellets, absorbed } = absorbAndFilterPellets(ally, pellets)
  const result = completeAvatarTransform(entities, ally, kind, -1)
  return { entities: result.entities, pellets: nextPellets, absorbed }
}

/** AI 根据农场/牧场比例决定优先化身类型（仅看质量与比例，位置另寻） */
export function decideAllyTransformKind(
  ally: CircleEntity,
  entities: CircleEntity[],
): 'farm' | 'ranch' | null {
  if (ally.avatarTransformCooldown > 0) return null

  const farms = countFarms(entities)
  const ranches = countRanches(entities)
  const ranchMassOk = ally.mass >= RANCH_BUILD_COST
  const farmMassOk = ally.mass >= FARM_BUILD_COST && canBuildMoreFarms(entities)

  const ranchPressure = farms >= Math.max(1, ranches) * Math.ceil(FARMS_PER_RANCH * 0.6)
  const needRanch = ranchPressure || !canBuildMoreFarms(entities)

  if (needRanch && ranchMassOk) return 'ranch'
  if (farmMassOk) return 'farm'
  if (ranchMassOk && ranches === 0) return 'ranch'
  return null
}

function absorbAndFilterPellets(
  entity: CircleEntity,
  pellets: Pellet[],
  grid?: PelletGrid,
): { pellets: Pellet[]; absorbed: Pellet[] } {
  const absorbed = absorbPelletsForAvatar(entity, pellets, grid)
  if (absorbed.length === 0) return { pellets, absorbed }
  const absorbedIds = new Set(absorbed.map((p) => p.id))
  return { pellets: removePelletsByIds(pellets, absorbedIds), absorbed }
}

export interface TransformResult {
  entities: CircleEntity[]
  newControlledId: number | null
}

function pickNextPlayerControl(entities: CircleEntity[], excludeId: number): number | null {
  for (const e of entities) {
    if (e.id === excludeId || !isActive(e) || e.isFrozen) continue
    if (e.avatarRole !== 'none' && e.avatarRole !== 'ally') continue
    e.isPlayer = true
    return e.id
  }
  return null
}

export function revertStructureToCircle(entity: CircleEntity): void {
  entity.avatarRole = 'none'
  entity.isFrozen = false
  entity.isPlayer = false
  entity.mass = PLAYER_START_MASS
  entity.name = entity.builderName || entity.name
  entity.pelletSpawnTimer = 0
  entity.allySpawnTimer = 0
  entity.structureProduceCount = 0
  initAvatarVitality(entity)
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

  const wasPlayer = entity.isPlayer && entity.id === controlledId
  entity.builderName = entity.name.replace(/·后$/, '').replace(/的(农场|牧场)$/, '')
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
  entity.structureProduceCount = 0
  entity.absorptionPaused = false

  return {
    entities,
    newControlledId: wasPlayer ? pickNextPlayerControl(entities, entity.id) : null,
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

export function absorbPelletsForAvatar(
  entity: CircleEntity,
  pellets: Pellet[],
  grid?: PelletGrid,
): Pellet[] {
  if (!canAvatarAbsorbPellets(entity)) return []
  const radius = avatarEntityRadius(entity)
  const absorbed: Pellet[] = []
  const collect = (pellet: Pellet) => {
    if (!canAbsorbPellet(entity.x, entity.y, radius, pellet)) return
    entity.mass = addMassLogarithmic(entity.mass, pellet.mass)
    absorbed.push(pellet)
  }
  if (grid) {
    grid.forEachInRadius(entity.x, entity.y, radius, collect)
  } else {
    for (const pellet of pellets) collect(pellet)
  }
  return absorbed
}

export function countPelletsNearFarm(farm: CircleEntity, grid: PelletGrid): number {
  return grid.countInRadius(farm.x, farm.y, FARM_PELLET_SENSE_RADIUS)
}

export function spawnPelletsAroundFarm(farm: CircleEntity): Pellet[] {
  const spawned: Pellet[] = []
  for (let i = 0; i < FARM_PELLET_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / FARM_PELLET_COUNT + Math.random() * 0.25
    const r = FARM_PELLET_RING_RADIUS + Math.random() * 35
    spawned.push(createPellet(farm.x + Math.cos(angle) * r, farm.y + Math.sin(angle) * r))
  }
  return spawned
}

export function updateFarmStructures(
  entities: CircleEntity[],
  pellets: Pellet[],
  grid: PelletGrid,
  dt: number,
): Pellet[] {
  if (pellets.length >= AVATAR_MAX_PELLETS) return pellets

  for (const entity of entities) {
    if (entity.avatarRole !== 'farm' || !entity.isFrozen) continue
    entity.pelletSpawnTimer -= dt
    if (entity.pelletSpawnTimer > 0) continue
    entity.pelletSpawnTimer = FARM_PELLET_INTERVAL_SEC
    if (pellets.length >= AVATAR_MAX_PELLETS) break
    if (countPelletsNearFarm(entity, grid) >= FARM_NEARBY_PELLET_CAP) continue
    pellets.push(...spawnPelletsAroundFarm(entity))
    entity.structureProduceCount++
    if (entity.structureProduceCount >= FARM_PELLET_CYCLES_BEFORE_REVERT) {
      revertStructureToCircle(entity)
    }
  }
  return trimPellets(pellets)
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
  initAvatarVitality(ally)
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
    entity.structureProduceCount++
    if (entity.structureProduceCount >= RANCH_ALLIES_BEFORE_REVERT) {
      revertStructureToCircle(entity)
    }
  }
  return next
}

export function updateAlly(
  ally: CircleEntity,
  entities: CircleEntity[],
  pellets: Pellet[],
  grid: PelletGrid,
  dt: number,
  now: number,
): { pellets: Pellet[]; absorbed: Pellet[]; entities: CircleEntity[] } {
  if (!isActive(ally) || ally.isFrozen) {
    return { pellets, absorbed: [], entities }
  }

  const transformKind = decideAllyTransformKind(ally, entities)

  if (transformKind) {
    const immediate = tryAllyTransform(ally, entities, pellets, transformKind)
    if (immediate.entities !== entities) {
      return { pellets: immediate.pellets, absorbed: immediate.absorbed, entities: immediate.entities }
    }

    const spot = findNearestAvatarTransformSpot(ally, transformKind, entities, now)
    if (spot) {
      moveEntityToward(ally, spot.x, spot.y, dt)
      const { pellets: movedPellets, absorbed: movedAbsorbed } = absorbAndFilterPellets(ally, pellets, grid)
      const afterMove = tryAllyTransform(ally, entities, movedPellets, transformKind)
      return {
        pellets: afterMove.pellets,
        absorbed: [...movedAbsorbed, ...afterMove.absorbed],
        entities: afterMove.entities,
      }
    }
  }

  const nearest = grid.findNearest(ally.x, ally.y, 2400)
  if (nearest) {
    moveEntityToward(ally, nearest.x, nearest.y, dt)
  }

  const { pellets: nextPellets, absorbed } = absorbAndFilterPellets(ally, pellets, grid)
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

/** 更新可移动圆的代谢、寿命，移除寿终实体 */
export function tickMobileAvatarVitality(
  entities: CircleEntity[],
  dt: number,
  movingIds: ReadonlySet<number>,
): CircleEntity[] {
  const next: CircleEntity[] = []
  for (const entity of entities) {
    if (entity.avatarRole === 'farm' || entity.avatarRole === 'ranch') {
      next.push(entity)
      continue
    }
    if (entity.avatarRole !== 'none' && entity.avatarRole !== 'ally') {
      next.push(entity)
      continue
    }
    if (!isActive(entity) || entity.isFrozen) {
      next.push(entity)
      continue
    }
    tickAvatarMetabolism(entity, dt, movingIds.has(entity.id))
    if (!isAvatarLifeExpired(entity)) next.push(entity)
  }
  return next
}

export { temperatureLabel } from './avatar-vitality'

export function getAvatarTransformHints(
  entity: CircleEntity | null,
  entities: CircleEntity[],
): { farm: string; ranch: string } {
  if (!entity) {
    return { farm: 'Q 农场(未就绪)', ranch: 'E 牧场(未就绪)' }
  }

  updateAbsorptionPause(entity)

  if (entity.avatarTransformCooldown > 0) {
    const sec = Math.ceil(entity.avatarTransformCooldown)
    return { farm: `Q 冷却(${sec}s)`, ranch: `E 冷却(${sec}s)` }
  }

  const farmMassOk = entity.mass >= FARM_BUILD_COST && canBuildMoreFarms(entities)
  const ranchMassOk = entity.mass >= RANCH_BUILD_COST
  const farmPlaceOk = farmMassOk && canPlaceAvatarTransform(entity, 'farm', entities)
  const ranchPlaceOk = ranchMassOk && canPlaceAvatarTransform(entity, 'ranch', entities)
  const saturated = entity.absorptionPaused

  let farm = 'Q 农场(未就绪)'
  if (saturated) farm = 'Q 农场(饱食中)'
  else if (farmMassOk && farmPlaceOk) farm = 'Q 化身农场'
  else if (farmMassOk && !canBuildMoreFarms(entities)) farm = 'Q 农场(需更多牧场)'
  else if (farmMassOk) farm = 'Q 农场(位置被占)'

  let ranch = 'E 牧场(质量不足)'
  if (ranchMassOk && ranchPlaceOk) ranch = 'E 化身牧场'
  else if (ranchMassOk) ranch = 'E 牧场(位置被占)'

  return { farm, ranch }
}

export function countTribeStructures(entities: CircleEntity[]): {
  farms: number
  ranches: number
  allies: number
  circles: number
} {
  let farms = 0
  let ranches = 0
  let allies = 0
  for (const e of entities) {
    if (e.avatarRole === 'farm') farms++
    if (e.avatarRole === 'ranch') ranches++
    if (e.avatarRole === 'ally' && isActive(e) && !e.isFrozen) allies++
  }
  return { farms, ranches, allies, circles: countMobileCircles(entities) }
}
