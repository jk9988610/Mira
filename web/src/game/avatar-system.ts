import { avatarEntityRadius, absorbRadiusForEntity, clampAvatarEntityToWorld } from './avatar-radius'
import {
  canAbsorbFoodPellets,
  isAvatarLifeExpired,
  onAvatarPelletAbsorbed,
  tickAvatarMetabolism,
  tickAvatarTransformLifespan,
} from './avatar-vitality'
import { canAbsorbPellet, clampPelletPosition, createPellet, type Pellet } from './pellet'
import type { CircleEntity, TransformKind } from './entity'
import { isActive, isAdult, isJuvenile } from './entity'
import {
  AVATAR_SEEK_CACHE_SEC,
  AVATAR_SEEK_FAIL_CACHE_SEC,
  AVATAR_SPAWN_OFFSET,
  AVATAR_TRANSFORM_DURATION_SEC,
  AVG_PELLET_MASS_ESTIMATE,
  WORK_PELLET_COUNT,
  WORK_PELLET_RING_RADIUS,
  WORK_PELLET_SENSE_RADIUS,
  PLAY_PELLET_COUNT,
  SATIETY_ABSORB_BATCH_RATIO,
  SATIETY_CAP,
  LEARN_PELLET_COUNT,
  SPAWN_CLEARANCE,
  ORDER_FULFILL_RADIUS,
  RESOURCE_EMIT_INTERVAL_FARM_SEC,
  RESOURCE_EMIT_INTERVAL_SCHOOL_SEC,
  RESOURCE_EMIT_INTERVAL_PARK_SEC,
} from './avatar-config'
import { decideNpcTransformKind, recordTransformHistory, updateNpcIntent } from './avatar-ai'
import { fulfillMarketOrder } from './family-market'
import { hasJuvenileOffspringToPlan } from './avatar-needs'
import { recordPelletProduction } from './production-stats'
import { startEmitterBurst } from './resource-ray'
import { isPursuingMate } from './avatar-reproduction'
import { syncEntityGeo } from './geo'
import { addIntakeMass, remainingIntakeRoom } from './avatar-mass'
import { addTraitIntake, canAbsorbPelletKind, workEfficiency } from './avatar-traits'
import { speedForMass } from './movement'
import type { PelletGrid } from './pellet-grid'
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
    case 'school':
      return `${builderName}的校园`
    case 'park':
      return `${builderName}的乐园`
  }
}

function isStructureRole(role: CircleEntity['avatarRole']): boolean {
  return role === 'farm' || role === 'school' || role === 'park'
}

export function countFarmStructures(entities: CircleEntity[]): number {
  return entities.filter((e) => e.avatarRole === 'farm').length
}

export function countSchoolStructures(entities: CircleEntity[]): number {
  return entities.filter((e) => e.avatarRole === 'school').length
}

export function countParkStructures(entities: CircleEntity[]): number {
  return entities.filter((e) => e.avatarRole === 'park').length
}

/** 世界中所有活跃圆（含化身建筑） */
export function countTotalCircles(entities: CircleEntity[]): number {
  let count = 0
  for (const e of entities) {
    if (isActive(e)) count++
  }
  return count
}

/** 可移动的圆：玩家与后代（不含上班/生产建筑） */
export function countMobileCircles(entities: CircleEntity[]): number {
  let count = 0
  for (const e of entities) {
    if (!isActive(e) || e.isFrozen) continue
    if (e.avatarRole === 'farm' || e.avatarRole === 'school' || e.avatarRole === 'park') continue
    count++
  }
  return count
}

/** @deprecated 上班/生产不再设数量制衡 */
export function canBuildMoreFarms(_entities: CircleEntity[]): boolean {
  return true
}

/** 生产不再限制后代数量 */
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

function isAvatarStructure(entity: CircleEntity): boolean {
  return isStructureRole(entity.avatarRole)
}

/** 在 (x,y) 放置指定建筑是否会与现有上班/生产重叠 */
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
  gameTimeSec = 0,
  forceMarket = false,
): boolean {
  if (!entity || !isActive(entity)) return false
  if (isJuvenile(entity, gameTimeSec)) return false
  if (entity.isFrozen) return false
  if (entity.avatarRole !== 'none' && entity.avatarRole !== 'ally') return false
  if (entity.avatarTransformCooldown > 0) return false
  if (!forceMarket && !canPlaceAvatarTransform(entity, _kind, entities)) return false
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
  syncEntityGeo(entity)
}

function tryAllyTransform(
  ally: CircleEntity,
  entities: CircleEntity[],
  kind: TransformKind,
  gameTimeSec = 0,
  forceMarket = false,
): { entities: CircleEntity[] } {
  if (!canBeginAvatarTransform(ally, kind, entities, gameTimeSec, forceMarket)) {
    return { entities }
  }
  return completeAvatarTransform(entities, ally, kind, gameTimeSec)
}

/** @deprecated 使用 decideNpcTransformKind */
export function decideAllyTransformKind(
  ally: CircleEntity,
  entities: CircleEntity[],
): TransformKind | null {
  return decideNpcTransformKind(ally, entities, 0)
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
  entity.structureProduceCount = 0
  entity.emitBurstSec = 0
  entity.avatarTransformTimer = 0
  entity.avatarTransformCooldown = 3
}

export function completeAvatarTransform(
  entities: CircleEntity[],
  entity: CircleEntity,
  kind: TransformKind,
  gameTimeSec = 0,
): TransformResult {
  const forceMarket = entity.marketContractOrderId > 0
  if (!canBeginAvatarTransform(entity, kind, entities, gameTimeSec, forceMarket)) {
    return { entities }
  }

  entity.builderName = entity.name
    .replace(/·后$/, '')
    .replace(/的(农场|牧场|校园|乐园)$/, '')
  entity.avatarRole = kind
  entity.isFrozen = true
  entity.name = structureLabel(kind, entity.builderName)
  entity.avatarTransformTimer = AVATAR_TRANSFORM_DURATION_SEC
  entity.pelletSpawnTimer =
    kind === 'farm'
      ? RESOURCE_EMIT_INTERVAL_FARM_SEC
      : kind === 'school'
        ? RESOURCE_EMIT_INTERVAL_SCHOOL_SEC
        : RESOURCE_EMIT_INTERVAL_PARK_SEC
  entity.emitBurstSec = 0
  startEmitterBurst(entity)
  entity.pendingAvatarKind = 'none'
  entity.avatarIncubateTimer = 0
  entity.invincibleTimer = 0
  entity.structureProduceCount = 0
  entity.avatarTransformCount++
  if (kind === 'farm') entity.countFarmTransforms++
  if (kind === 'school') entity.countSchoolTransforms++
  if (kind === 'park') entity.countParkTransforms++
  entity.absorptionPaused = false
  recordTransformHistory(entity, kind)

  if (entity.marketContractOrderId > 0) {
    fulfillMarketOrder(entity.marketContractOrderId, entity.id, gameTimeSec)
    entity.marketContractOrderId = 0
    entity.contractTargetX = 0
    entity.contractTargetY = 0
  }

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

  const absorbRadius = absorbRadiusForEntity(entity)
  const absorbed: Pellet[] = []
  let absorbedMass = 0
  const intakeRoom = remainingIntakeRoom(entity)

  const maxFoodPellets =
    entity.satiety >= SATIETY_CAP * SATIETY_ABSORB_BATCH_RATIO
      ? Math.max(1, Math.ceil(intakeRoom / AVG_PELLET_MASS_ESTIMATE))
      : Number.POSITIVE_INFINITY

  const collect = (pellet: Pellet) => {
    if (!canAbsorbPellet(entity.x, entity.y, absorbRadius, pellet)) return

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
    grid.forEachInRadius(entity.x, entity.y, absorbRadius, collect)
  } else {
    for (const pellet of pellets) collect(pellet)
  }
  return absorbed
}

function farmPelletSenseRadius(farm: CircleEntity): number {
  const baseR = avatarEntityRadius(farm)
  return Math.max(WORK_PELLET_SENSE_RADIUS, baseR * 2.8)
}

function farmPelletRingRadius(farm: CircleEntity): number {
  const baseR = avatarEntityRadius(farm)
  return Math.max(WORK_PELLET_RING_RADIUS * 0.55, baseR * 2.1)
}

export function countPelletsNearFarm(farm: CircleEntity, grid: PelletGrid): number {
  return grid.countInRadius(farm.x, farm.y, farmPelletSenseRadius(farm))
}

export function spawnPelletsAroundFarm(farm: CircleEntity): Pellet[] {
  const ringRadius = farmPelletRingRadius(farm)
  const spawned: Pellet[] = []
  const count = Math.max(3, Math.round(WORK_PELLET_COUNT * workEfficiency(farm)))
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25
    const r = ringRadius + Math.random() * ringRadius * 0.28
    const pellet = createPellet(farm.x + Math.cos(angle) * r, farm.y + Math.sin(angle) * r)
    const pos = clampPelletPosition(pellet.x, pellet.y, pellet.radius, WORLD_WIDTH, WORLD_HEIGHT)
    pellet.x = pos.x
    pellet.y = pos.y
    spawned.push(pellet)
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

function tickStructureEmit(
  entity: CircleEntity,
  intervalSec: number,
  kind: 'food' | 'knowledge' | 'joy',
  unitCount: number,
  dt: number,
): void {
  entity.pelletSpawnTimer -= dt
  if (entity.pelletSpawnTimer > 0) return
  entity.pelletSpawnTimer = intervalSec
  startEmitterBurst(entity)
  const count = Math.max(2, Math.round(unitCount * workEfficiency(entity)))
  recordPelletProduction(kind, count)
}

export function updateFarmStructures(entities: CircleEntity[], dt: number): void {
  for (const entity of entities) {
    if (entity.avatarRole !== 'farm' || !entity.isFrozen) continue
    if (tickStructureTimer(entity, dt)) continue
    tickStructureEmit(entity, RESOURCE_EMIT_INTERVAL_FARM_SEC, 'food', WORK_PELLET_COUNT, dt)
  }
}

export function updateSchoolStructures(entities: CircleEntity[], dt: number): void {
  for (const entity of entities) {
    if (entity.avatarRole !== 'school' || !entity.isFrozen) continue
    if (tickStructureTimer(entity, dt)) continue
    tickStructureEmit(entity, RESOURCE_EMIT_INTERVAL_SCHOOL_SEC, 'knowledge', LEARN_PELLET_COUNT, dt)
  }
}

export function updateParkStructures(entities: CircleEntity[], dt: number): void {
  for (const entity of entities) {
    if (entity.avatarRole !== 'park' || !entity.isFrozen) continue
    if (tickStructureTimer(entity, dt)) continue
    tickStructureEmit(entity, RESOURCE_EMIT_INTERVAL_PARK_SEC, 'joy', PLAY_PELLET_COUNT, dt)
  }
}

function atTransformSpot(entity: CircleEntity, x: number, y: number): boolean {
  const arrive = Math.max(10, avatarEntityRadius(entity) * 0.55)
  return Math.hypot(x - entity.x, y - entity.y) <= arrive
}

function updatePendingAvatarTransform(
  ally: CircleEntity,
  entities: CircleEntity[],
  dt: number,
  now: number,
): { entities: CircleEntity[] } | null {
  if (ally.pendingAvatarKind === 'none') return null

  const kind = ally.pendingAvatarKind
  ally.aiIntent = ally.avatarTransformCooldown > 0 ? 'wait' : 'wander'

  const useContractSpot = ally.marketContractOrderId > 0
  const spot = useContractSpot
    ? { x: ally.contractTargetX, y: ally.contractTargetY }
    : findNearestAvatarTransformSpot(ally, kind, entities, now)

  if (!spot) {
    ally.pendingAvatarKind = 'none'
    return null
  }

  ally.aiAnchorX = spot.x
  ally.aiAnchorY = spot.y
  ally.intentTargetX = spot.x
  ally.intentTargetY = spot.y

  const arriveDist = useContractSpot
    ? Math.max(12, ORDER_FULFILL_RADIUS * 0.45)
    : Math.max(10, avatarEntityRadius(ally) * 0.55)

  if (!atTransformSpot(ally, spot.x, spot.y) && Math.hypot(spot.x - ally.x, spot.y - ally.y) > arriveDist) {
    moveEntityToward(ally, spot.x, spot.y, dt)
    ally.intentEtaSec = Math.hypot(spot.x - ally.x, spot.y - ally.y) / Math.max(18, speedForMass(ally.mass))
    clampAvatarEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
    syncEntityGeo(ally)
    return { entities }
  }

  if (ally.avatarTransformCooldown > 0) {
    return { entities }
  }

  const forceMarket = useContractSpot
  if (!canBeginAvatarTransform(ally, kind, entities, now, forceMarket)) {
    return { entities }
  }

  const result = tryAllyTransform(ally, entities, kind, now, forceMarket)
  ally.pendingAvatarKind = 'none'
  ally.intentEtaSec = 0
  return result
}

export function updateAlly(
  ally: CircleEntity,
  entities: CircleEntity[],
  dt: number,
  now: number,
): { entities: CircleEntity[] } {
  if (!isActive(ally) || ally.isFrozen) {
    return { entities }
  }

  const pending = updatePendingAvatarTransform(ally, entities, dt, now)
  if (pending) return pending

  const intent = updateNpcIntent(ally, entities, dt, now)

  if (isPursuingMate(ally, now)) {
    return { entities }
  }

  const transformKind = hasJuvenileOffspringToPlan(ally, entities, now)
    ? decideNpcTransformKind(ally, entities, now)
    : null

  if (transformKind) {
    const spot = findNearestAvatarTransformSpot(ally, transformKind, entities, now)
    if (spot) {
      ally.pendingAvatarKind = transformKind
      ally.aiAnchorX = spot.x
      ally.aiAnchorY = spot.y
      if (!atTransformSpot(ally, spot.x, spot.y)) {
        moveEntityToward(ally, spot.x, spot.y, dt)
      } else if (ally.avatarTransformCooldown <= 0) {
        const committed = updatePendingAvatarTransform(ally, entities, dt, now)
        if (committed) return committed
      }
      clampAvatarEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
      syncEntityGeo(ally)
      return { entities }
    }
  }

  if (intent.moving || ally.productionStage !== 'none') {
    clampAvatarEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
    syncEntityGeo(ally)
  }

  clampAvatarEntityToWorld(ally, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(ally)
  return { entities }
}

export function applyFrozenMovement(entity: CircleEntity, moveX: number, moveY: number, dt: number): void {
  if (entity.isFrozen) return
  const len = Math.hypot(moveX, moveY)
  if (len < 0.1) return
  const speed = speedForMass(entity.mass)
  entity.x += (moveX / len) * speed * dt
  entity.y += (moveY / len) * speed * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(entity)
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

export { decideNpcTransformKind } from './avatar-ai'
export { initOptimalAvatarState, satietyLabel } from './avatar-vitality'
export { healthLabel } from './avatar-mass'
export { traitLabel } from './avatar-traits'

function transformHint(
  entity: CircleEntity,
  entities: CircleEntity[],
  kind: TransformKind,
  key: string,
  label: string,
  gameTimeSec = 0,
): string {
  if (isJuvenile(entity, gameTimeSec)) return `${key} 未成年禁化身`
  if (entity.avatarRole === kind) return `${key} 化身${label}中`
  if (entity.avatarTransformCooldown > 0) return `${key} 冷却(${Math.ceil(entity.avatarTransformCooldown)}s)`
  if (!canPlaceAvatarTransform(entity, kind, entities)) return `${key} ${label}(位置被占)`
  return `${key} 化身${label}`
}

export interface AvatarTransformHints {
  farmHint: string
  produceHint: string
  schoolHint: string
  parkHint: string
  canFarm: boolean
  canMate: boolean
  canSchool: boolean
  canPark: boolean
  farmCount: number
  schoolCount: number
  parkCount: number
}

export function getAvatarTransformHints(
  entity: CircleEntity | null,
  entities: CircleEntity[],
  gameTimeSec = 0,
): AvatarTransformHints {
  const farmCount = countFarmStructures(entities)
  const schoolCount = countSchoolStructures(entities)
  const parkCount = countParkStructures(entities)

  if (!entity) {
    return {
      farmHint: 'Q 农场',
      produceHint: 'E 生产',
      schoolHint: 'Z 校园',
      parkHint: 'X 乐园',
      canFarm: false,
      canMate: false,
      canSchool: false,
      canPark: false,
      farmCount,
      schoolCount,
      parkCount,
    }
  }

  const canFarm = canBeginAvatarTransform(entity, 'farm', entities, gameTimeSec)
  const canSchool = canBeginAvatarTransform(entity, 'school', entities, gameTimeSec)
  const canPark = canBeginAvatarTransform(entity, 'park', entities, gameTimeSec)
  const canMate =
    !isJuvenile(entity, gameTimeSec) &&
    entity.productionStage === 'none' &&
    !entity.isFrozen &&
    isAdult(entity, gameTimeSec)

  if (isJuvenile(entity, gameTimeSec)) {
    return {
      farmHint: 'Q 未成年禁化身',
      produceHint: 'E 未成年禁生产',
      schoolHint: 'Z 未成年禁化身',
      parkHint: 'X 未成年禁化身',
      canFarm: false,
      canMate: false,
      canSchool: false,
      canPark: false,
      farmCount,
      schoolCount,
      parkCount,
    }
  }

  if (isStructureRole(entity.avatarRole)) {
    return {
      farmHint: entity.avatarRole === 'farm' ? 'Q 化身农场中' : 'Q 化身中',
      produceHint: entity.productionStage !== 'none' ? 'E 生产中' : 'E 生产',
      schoolHint: entity.avatarRole === 'school' ? 'Z 化身校园中' : 'Z 化身中',
      parkHint: entity.avatarRole === 'park' ? 'X 化身乐园中' : 'X 化身中',
      canFarm,
      canMate,
      canSchool,
      canPark,
      farmCount,
      schoolCount,
      parkCount,
    }
  }

  return {
    farmHint: transformHint(entity, entities, 'farm', 'Q', '农场', gameTimeSec),
    produceHint:
      entity.productionStage !== 'none'
        ? 'E 生产中'
        : canMate
          ? 'E 生产'
          : 'E 生产(需成年异性)',
    schoolHint: transformHint(entity, entities, 'school', 'Z', '校园', gameTimeSec),
    parkHint: transformHint(entity, entities, 'park', 'X', '乐园', gameTimeSec),
    canFarm,
    canMate,
    canSchool,
    canPark,
    farmCount,
    schoolCount,
    parkCount,
  }
}

export function countTribeStructures(entities: CircleEntity[]): {
  farm: number
  school: number
  park: number
  producing: number
  circles: number
} {
  let farm = 0
  let school = 0
  let park = 0
  let producing = 0
  for (const e of entities) {
    if (e.avatarRole === 'farm') farm++
    if (e.avatarRole === 'school') school++
    if (e.avatarRole === 'park') park++
    if (e.productionStage !== 'none') producing++
  }
  return { farm, school, park, producing, circles: countTotalCircles(entities) }
}
