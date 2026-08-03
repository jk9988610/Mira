import { avatarChildRadius, avatarEntityRadius, clampAvatarEntityToWorld } from './avatar-radius'
import {
  canAbsorbFoodPellets,
  initAvatarVitality,
  isAvatarLifeExpired,
  onAvatarPelletAbsorbed,
  tickAvatarMetabolism,
  tickAvatarTransformLifespan,
} from './avatar-vitality'
import { canAbsorbPellet, createPellet, createTraitPellet, type Pellet } from './pellet'
import { PLAYER_START_MASS } from './physics'
import type { CircleEntity, TransformKind } from './entity'
import { createCircle, isActive } from './entity'
import {
  AVATAR_SEEK_CACHE_SEC,
  AVATAR_SEEK_FAIL_CACHE_SEC,
  AVATAR_SPAWN_OFFSET,
  AVATAR_MAX_PELLETS,
  AVATAR_TRANSFORM_DURATION_SEC,
  AVG_PELLET_MASS_ESTIMATE,
  FARM_NEARBY_PELLET_CAP,
  FARM_PELLET_COUNT,
  FARM_PELLET_INTERVAL_SEC,
  FARM_PELLET_RING_RADIUS,
  FARM_PELLET_SENSE_RADIUS,
  PARK_PELLET_COUNT,
  PARK_PELLET_INTERVAL_SEC,
  RANCH_ALLY_INTERVAL_SEC,
  SATIETY_ABSORB_BATCH_RATIO,
  SATIETY_CAP,
  SCHOOL_PELLET_COUNT,
  SCHOOL_PELLET_INTERVAL_SEC,
  SPAWN_CLEARANCE,
} from './avatar-config'
import { decideNpcTransformKind, recordTransformHistory, updateNpcIntent } from './avatar-ai'
import { addIntakeMass, remainingIntakeRoom } from './avatar-mass'
import { addTraitIntake, canAbsorbPelletKind, workEfficiency } from './avatar-traits'
import { speedForMass } from './movement'
import type { PelletGrid } from './pellet-grid'
import { removePelletsByIds } from './pellet-util'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

type AllySeekCache =
  | { kind: TransformKind; status: 'hit'; x: number; y: number; expiresAt: number }
  | { kind: TransformKind; status: 'miss'; expiresAt: number }
const allySeekCache = new Map<number, AllySeekCache>()

export function resetAvatarState(): void {
  allySeekCache.clear()
}

export { avatarEntityRadius } from './avatar-radius'

export function getControlledEntity(
  entities: CircleEntity[],
  controlledId: number,
): CircleEntity | null {
  const direct = entities.find((e) => e.id === controlledId && e.isPlayer && isActive(e)) ?? null
  if (direct) return direct
  return entities.find((e) => e.isPlayer && isActive(e)) ?? null
}


function structureLabel(kind: TransformKind, builderName: string): string {
  switch (kind) {
    case 'farm':
      return `${builderName}的农场`
    case 'ranch':
      return `${builderName}的牧场`
    case 'school':
      return `${builderName}的学校`
    case 'park':
      return `${builderName}的乐园`
  }
}

function isStructureRole(role: CircleEntity['avatarRole']): boolean {
  return role === 'farm' || role === 'ranch' || role === 'school' || role === 'park'
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
    if (e.avatarRole === 'farm' || e.avatarRole === 'ranch' || e.avatarRole === 'school' || e.avatarRole === 'park') continue
    count++
  }
  return count
}

/** @deprecated 农场/牧场不再设数量制衡 */
export function canBuildMoreFarms(_entities: CircleEntity[]): boolean {
  return true
}

/** 牧场不再限制后代数量 */
export function canRanchSpawnAlly(_entities: CircleEntity[]): boolean {
  return true
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

function isAvatarStructure(entity: CircleEntity): boolean {
  return isStructureRole(entity.avatarRole)
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
  _kind: TransformKind,
  entities: CircleEntity[],
): boolean {
  const structureR = avatarEntityRadius(entity)
  return !wouldOverlapStructures(entity.x, entity.y, structureR, entities, entity.id)
}

export function canBeginAvatarTransform(
  entity: CircleEntity | null,
  _kind: TransformKind,
  entities: CircleEntity[],
): boolean {
  if (!entity || !isActive(entity)) return false
  if (entity.isFrozen) return false
  if (entity.avatarRole !== 'none' && entity.avatarRole !== 'ally') return false
  if (entity.avatarTransformCooldown > 0) return false
  if (!canPlaceAvatarTransform(entity, _kind, entities)) return false
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
  kind: TransformKind,
  entities: CircleEntity[],
  now = 0,
): { x: number; y: number } | null {
  const cached = allySeekCache.get(entity.id)
  if (cached && cached.kind === kind && cached.expiresAt > now) {
    if (cached.status === 'miss') return null
    return { x: cached.x, y: cached.y }
  }

  const structureR = avatarEntityRadius(entity)

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
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

function tryAllyTransform(
  ally: CircleEntity,
  entities: CircleEntity[],
  pellets: Pellet[],
  kind: TransformKind,
): { entities: CircleEntity[]; pellets: Pellet[]; absorbed: Pellet[] } {
  if (!canBeginAvatarTransform(ally, kind, entities)) {
    return { entities, pellets, absorbed: [] }
  }
  const { pellets: nextPellets, absorbed } = absorbAndFilterPellets(ally, pellets)
  const result = completeAvatarTransform(entities, ally, kind)
  return { entities: result.entities, pellets: nextPellets, absorbed }
}

/** @deprecated 使用 decideNpcTransformKind */
export function decideAllyTransformKind(
  ally: CircleEntity,
  entities: CircleEntity[],
): TransformKind | null {
  return decideNpcTransformKind(ally, entities)
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
}

/** 结束化身状态，恢复化身前的质量与饥饿 */
export function endAvatarTransform(entity: CircleEntity): void {
  entity.avatarRole = 'none'
  entity.isFrozen = false
  entity.name = entity.builderName || entity.name
  entity.pelletSpawnTimer = 0
  entity.allySpawnTimer = 0
  entity.structureProduceCount = 0
  entity.avatarTransformTimer = 0
  entity.avatarTransformCooldown = 3
}

export function completeAvatarTransform(
  entities: CircleEntity[],
  entity: CircleEntity,
  kind: TransformKind,
): TransformResult {
  if (!canBeginAvatarTransform(entity, kind, entities)) {
    return { entities }
  }

  entity.builderName = entity.name
    .replace(/·后$/, '')
    .replace(/的(农场|牧场|学校|乐园)$/, '')
  entity.avatarRole = kind
  entity.isFrozen = true
  entity.name = structureLabel(kind, entity.builderName)
  entity.avatarTransformTimer = AVATAR_TRANSFORM_DURATION_SEC
  entity.pelletSpawnTimer =
    kind === 'farm'
      ? FARM_PELLET_INTERVAL_SEC
      : kind === 'school'
        ? SCHOOL_PELLET_INTERVAL_SEC
        : kind === 'park'
          ? PARK_PELLET_INTERVAL_SEC
          : 0
  entity.allySpawnTimer = kind === 'ranch' ? RANCH_ALLY_INTERVAL_SEC : 0
  entity.pendingAvatarKind = 'none'
  entity.avatarIncubateTimer = 0
  entity.invincibleTimer = 0
  entity.structureProduceCount = 0
  entity.avatarTransformCount++
  entity.absorptionPaused = false
  recordTransformHistory(entity, kind)

  return { entities }
}

export function getAvatarTransformCountdownSec(entity: CircleEntity): number | null {
  if (!entity.isFrozen || !isStructureRole(entity.avatarRole)) return null
  return Math.max(0, entity.avatarTransformTimer)
}

export function absorbPelletsForAvatar(
  entity: CircleEntity,
  pellets: Pellet[],
  grid?: PelletGrid,
): Pellet[] {
  if (!isActive(entity) || entity.isFrozen || isStructureRole(entity.avatarRole)) return []

  const radius = avatarEntityRadius(entity)
  const absorbed: Pellet[] = []
  let absorbedMass = 0
  const intakeRoom = remainingIntakeRoom(entity)

  const maxFoodPellets =
    entity.satiety >= SATIETY_CAP * SATIETY_ABSORB_BATCH_RATIO
      ? Math.max(1, Math.ceil(intakeRoom / AVG_PELLET_MASS_ESTIMATE))
      : Number.POSITIVE_INFINITY

  const collect = (pellet: Pellet) => {
    if (!canAbsorbPellet(entity.x, entity.y, radius, pellet)) return

    if (pellet.kind === 'food') {
      if (!canAbsorbFoodPellets(entity)) return
      if (absorbed.filter((p) => p.kind === 'food').length >= maxFoodPellets) return
      if (absorbedMass >= intakeRoom) return
      const gain = addIntakeMass(entity, pellet.mass)
      if (gain <= 0) return
      absorbedMass += gain
      onAvatarPelletAbsorbed(entity, gain)
      absorbed.push(pellet)
      return
    }

    if (!canAbsorbPelletKind(entity, pellet.kind)) return
    const traitGain = addTraitIntake(entity, pellet.kind, pellet.mass)
    if (traitGain <= 0) return
    absorbed.push(pellet)
  }

  if (grid) {
    grid.forEachInRadius(entity.x, entity.y, radius, collect)
  } else {
    for (const pellet of pellets) collect(pellet)
  }
  return absorbed
}

function farmPelletSenseRadius(farm: CircleEntity): number {
  const baseR = avatarEntityRadius(farm)
  return Math.max(FARM_PELLET_SENSE_RADIUS, baseR * 2.8)
}

function farmPelletRingRadius(farm: CircleEntity): number {
  const baseR = avatarEntityRadius(farm)
  return Math.max(FARM_PELLET_RING_RADIUS * 0.55, baseR * 2.1)
}

export function countPelletsNearFarm(farm: CircleEntity, grid: PelletGrid): number {
  return grid.countInRadius(farm.x, farm.y, farmPelletSenseRadius(farm))
}

export function spawnPelletsAroundFarm(farm: CircleEntity): Pellet[] {
  const ringRadius = farmPelletRingRadius(farm)
  const spawned: Pellet[] = []
  const count = Math.max(3, Math.round(FARM_PELLET_COUNT * workEfficiency(farm)))
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25
    const r = ringRadius + Math.random() * ringRadius * 0.28
    spawned.push(createPellet(farm.x + Math.cos(angle) * r, farm.y + Math.sin(angle) * r))
  }
  return spawned
}

function spawnTraitPelletsAround(
  structure: CircleEntity,
  kind: 'knowledge' | 'joy',
  count: number,
): Pellet[] {
  const ringRadius = farmPelletRingRadius(structure)
  const spawned: Pellet[] = []
  const amount = Math.max(2, Math.round(count * workEfficiency(structure)))
  for (let i = 0; i < amount; i++) {
    const angle = (Math.PI * 2 * i) / amount + Math.random() * 0.3
    const r = ringRadius + Math.random() * ringRadius * 0.25
    spawned.push(createTraitPellet(structure.x + Math.cos(angle) * r, structure.y + Math.sin(angle) * r, kind))
  }
  return spawned
}

function tickStructureTimer(entity: CircleEntity, dt: number): boolean {
  entity.avatarTransformTimer -= dt
  if (entity.avatarTransformTimer <= 0) {
    endAvatarTransform(entity)
    return true
  }
  return false
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
    if (tickStructureTimer(entity, dt)) continue
    entity.pelletSpawnTimer -= dt
    if (entity.pelletSpawnTimer > 0) continue
    entity.pelletSpawnTimer = FARM_PELLET_INTERVAL_SEC
    entity.structureProduceCount++
    if (pellets.length < AVATAR_MAX_PELLETS && countPelletsNearFarm(entity, grid) < FARM_NEARBY_PELLET_CAP) {
      pellets.push(...spawnPelletsAroundFarm(entity))
    }
  }
  return trimPellets(pellets)
}

export function updateSchoolStructures(
  entities: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): Pellet[] {
  if (pellets.length >= AVATAR_MAX_PELLETS) return pellets
  for (const entity of entities) {
    if (entity.avatarRole !== 'school' || !entity.isFrozen) continue
    if (tickStructureTimer(entity, dt)) continue
    entity.pelletSpawnTimer -= dt
    if (entity.pelletSpawnTimer > 0) continue
    entity.pelletSpawnTimer = SCHOOL_PELLET_INTERVAL_SEC
    pellets.push(...spawnTraitPelletsAround(entity, 'knowledge', SCHOOL_PELLET_COUNT))
  }
  return trimPellets(pellets)
}

export function updateParkStructures(
  entities: CircleEntity[],
  pellets: Pellet[],
  dt: number,
): Pellet[] {
  if (pellets.length >= AVATAR_MAX_PELLETS) return pellets
  for (const entity of entities) {
    if (entity.avatarRole !== 'park' || !entity.isFrozen) continue
    if (tickStructureTimer(entity, dt)) continue
    entity.pelletSpawnTimer -= dt
    if (entity.pelletSpawnTimer > 0) continue
    entity.pelletSpawnTimer = PARK_PELLET_INTERVAL_SEC
    pellets.push(...spawnTraitPelletsAround(entity, 'joy', PARK_PELLET_COUNT))
  }
  return trimPellets(pellets)
}

export function spawnRanchAlly(entities: CircleEntity[], ranch: CircleEntity): CircleEntity[] {
  const childRadius = avatarChildRadius(PLAYER_START_MASS)
  const spawn = findClearSpawnPosition(ranch.x, ranch.y, childRadius, entities, ranch.id)
  if (!spawn) return entities
  const parentName = ranch.builderName || ranch.name.replace(/的牧场$/, '')
  const roster = {
    name: parentName,
    colorLight: ranch.colorLight,
    colorDark: ranch.colorDark,
    strokeColor: ranch.strokeColor,
  }
  const ally = createCircle(spawn.x, spawn.y, PLAYER_START_MASS, false, roster)
  ally.avatarRole = 'ally'
  ally.name = parentName
  ally.builderName = parentName
  initAvatarVitality(ally)
  clampAvatarEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
  return [...entities, ally]
}

export function updateRanchStructures(entities: CircleEntity[], dt: number): CircleEntity[] {
  let next = entities
  for (const entity of entities) {
    if (entity.avatarRole !== 'ranch' || !entity.isFrozen) continue
    if (tickStructureTimer(entity, dt)) continue
    entity.allySpawnTimer -= dt
    if (entity.allySpawnTimer > 0) continue
    entity.allySpawnTimer = RANCH_ALLY_INTERVAL_SEC

    if (canRanchSpawnAlly(next)) {
      const beforeCount = next.length
      next = spawnRanchAlly(next, entity)
      if (next.length > beforeCount) entity.structureProduceCount++
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

  const intent = updateNpcIntent(ally, entities, grid, dt)
  ally.aiSleeping = intent.sleeping

  const transformKind = decideNpcTransformKind(ally, entities)

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

  if (ally.aiSchedulePhase === 'forage' || ally.aiSchedulePhase === 'work' || ally.aiSchedulePhase === 'learn' || ally.aiSchedulePhase === 'play') {
    const { pellets: nextPellets, absorbed } = absorbAndFilterPellets(ally, pellets, grid)
    return { pellets: nextPellets, absorbed, entities }
  }

  return { pellets, absorbed: [], entities }
}

export function applyFrozenMovement(entity: CircleEntity, moveX: number, moveY: number, dt: number): void {
  if (entity.isFrozen) return
  const len = Math.hypot(moveX, moveY)
  if (len < 0.1) return
  const speed = speedForMass(entity.mass)
  entity.x += (moveX / len) * speed * dt
  entity.y += (moveY / len) * speed * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
}

/** 更新可移动圆的代谢、寿命，移除寿终实体 */
export function tickMobileAvatarVitality(
  entities: CircleEntity[],
  dt: number,
  movingIds: ReadonlySet<number>,
): CircleEntity[] {
  const next: CircleEntity[] = []
  for (const entity of entities) {
    if (isStructureRole(entity.avatarRole)) {
      tickAvatarTransformLifespan(entity, dt)
      if (!isAvatarLifeExpired(entity)) next.push(entity)
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

export { decideNpcTransformKind, schedulePhaseLabel } from './avatar-ai'
export { initOptimalAvatarState, satietyLabel } from './avatar-vitality'
export { healthLabel } from './avatar-mass'
export { traitLabel } from './avatar-traits'

function transformHint(
  entity: CircleEntity,
  entities: CircleEntity[],
  kind: TransformKind,
  key: string,
  label: string,
): string {
  if (entity.avatarRole === kind) return `${key} 化身${label}中`
  if (entity.avatarTransformCooldown > 0) return `${key} 冷却(${Math.ceil(entity.avatarTransformCooldown)}s)`
  if (!canPlaceAvatarTransform(entity, kind, entities)) return `${key} ${label}(位置被占)`
  return `${key} 化身${label}`
}

export function getAvatarTransformHints(
  entity: CircleEntity | null,
  entities: CircleEntity[],
): { farm: string; ranch: string; school: string; park: string } {
  if (!entity) {
    return {
      farm: 'Q 农场',
      ranch: 'E 牧场',
      school: 'Z 学校',
      park: 'X 乐园',
    }
  }

  if (isStructureRole(entity.avatarRole)) {
    return {
      farm: entity.avatarRole === 'farm' ? 'Q 化身农场中' : 'Q 化身中',
      ranch: entity.avatarRole === 'ranch' ? 'E 化身牧场中' : 'E 化身中',
      school: entity.avatarRole === 'school' ? 'Z 化身学校中' : 'Z 化身中',
      park: entity.avatarRole === 'park' ? 'X 化身乐园中' : 'X 化身中',
    }
  }

  return {
    farm: transformHint(entity, entities, 'farm', 'Q', '农场'),
    ranch: transformHint(entity, entities, 'ranch', 'E', '牧场'),
    school: transformHint(entity, entities, 'school', 'Z', '学校'),
    park: transformHint(entity, entities, 'park', 'X', '乐园'),
  }
}

export function countTribeStructures(entities: CircleEntity[]): {
  farms: number
  ranches: number
  schools: number
  parks: number
  allies: number
  circles: number
} {
  let farms = 0
  let ranches = 0
  let schools = 0
  let parks = 0
  let allies = 0
  for (const e of entities) {
    if (e.avatarRole === 'farm') farms++
    if (e.avatarRole === 'ranch') ranches++
    if (e.avatarRole === 'school') schools++
    if (e.avatarRole === 'park') parks++
    if (e.avatarRole === 'ally' && isActive(e) && !e.isFrozen) allies++
  }
  return { farms, ranches, schools, parks, allies, circles: countMobileCircles(entities) }
}
