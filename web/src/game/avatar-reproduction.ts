import {
  ELDER_MATE_AGE_SEC,
  MATE_INTENT_COOLDOWN_BASE_SEC,
  MATE_INTENT_WINDOW_SEC,
  MATE_PURSUIT_SPEED,
  MATE_SIGNAL_MIN_STRENGTH,
  MATE_SIGNAL_RANGE_RATIO,
  OFFSPRING_MOTHER_BOND_SEC,
  PRODUCTION_COOLDOWN_SEC,
  PRODUCTION_DURATION_SEC,
} from './avatar-config'
import { avatarEntityRadius, clampAvatarEntityToWorld } from './avatar-radius'
import { initAvatarVitality } from './avatar-vitality'
import { inheritPalette } from './color-genetics'
import { areKin } from './kinship'
import { syncEntityGeo } from './geo'
import { offspringName } from './naming'
import type { CircleEntity, Gender } from './entity'
import { createCircle, entityAgeSec, isActive, isAdult } from './entity'
import { PLAYER_START_MASS } from './physics'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const MATE_SIGNAL_RANGE = WORLD_WIDTH * MATE_SIGNAL_RANGE_RATIO

function elderMateFactor(entity: CircleEntity, gameTimeSec: number): number {
  const age = entityAgeSec(entity, gameTimeSec)
  if (age < ELDER_MATE_AGE_SEC) return 1
  const t = Math.min(1, (age - ELDER_MATE_AGE_SEC) / 40)
  return Math.max(0.06, 1 - t * 0.92)
}

function distanceBetween(a: CircleEntity, b: CircleEntity): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 雄性求偶信号强度，随距离二次衰减；高龄大幅衰减 */
export function mateSignalStrength(
  male: CircleEntity,
  female: CircleEntity,
  gameTimeSec = 0,
): number {
  const dist = distanceBetween(male, female)
  if (dist > MATE_SIGNAL_RANGE) return 0
  const t = dist / MATE_SIGNAL_RANGE
  const decay = (1 - t) * (1 - t)
  const urge = 0.55 + male.mateSeekUrge * 0.45
  return decay * urge * elderMateFactor(male, gameTimeSec) * elderMateFactor(female, gameTimeSec)
}

export function isPursuingMate(entity: CircleEntity, now = 0): boolean {
  return isActivelySeekingMate(entity, now) && entity.aiMateTargetId > 0
}

function canMatePair(a: CircleEntity, b: CircleEntity, gameTimeSec = 0): boolean {
  if (a.gender === b.gender) return false
  const male = a.gender === 'male' ? a : b
  const female = a.gender === 'female' ? a : b
  if (areKin(male, female)) return false
  return isSeekingMate(male, gameTimeSec) && isSeekingMate(female, gameTimeSec)
}

/** 雌性追随最强信号，雄性锁定回应自己的雌性 */
export function syncMateTargets(entities: CircleEntity[], now = 0): void {
  for (const e of entities) {
    if (!isActive(e) || e.productionStage !== 'none') {
      e.aiMateTargetId = 0
      continue
    }
    if (!isActivelySeekingMate(e, now)) {
      e.aiMateTargetId = 0
      continue
    }
    if (e.aiMateTargetId > 0) {
      const partner = entities.find((p) => p.id === e.aiMateTargetId)
      if (!partner || !isActive(partner) || !isActivelySeekingMate(partner, now) || !canMatePair(e, partner, now)) {
        e.aiMateTargetId = 0
      }
    }
  }

  for (const female of entities) {
    if (!isActive(female) || female.gender !== 'female') continue
    if (!isActivelySeekingMate(female, now)) continue

    let bestMale: CircleEntity | null = null
    let bestStrength = MATE_SIGNAL_MIN_STRENGTH
    for (const male of entities) {
      if (!isActive(male) || male.gender !== 'male') continue
      if (!isActivelySeekingMate(male, now)) continue
      if (areKin(male, female)) continue
      const strength = mateSignalStrength(male, female, now)
      if (strength > bestStrength) {
        bestStrength = strength
        bestMale = male
      }
    }
    female.aiMateTargetId = bestMale?.id ?? 0
  }

  for (const male of entities) {
    if (!isActive(male) || male.gender !== 'male') continue
    if (!isActivelySeekingMate(male, now)) continue

    let bestFemale: CircleEntity | null = null
    let bestDist = Infinity
    for (const female of entities) {
      if (!isActive(female) || female.gender !== 'female') continue
      if (!isActivelySeekingMate(female, now)) continue
      if (female.aiMateTargetId !== male.id) continue
      if (areKin(male, female)) continue
      const d = distanceBetween(male, female)
      if (d < bestDist) {
        bestDist = d
        bestFemale = female
      }
    }
    male.aiMateTargetId = bestFemale?.id ?? 0
  }
}

function moveTowardPartner(entity: CircleEntity, partner: CircleEntity, dt: number): void {
  const dx = partner.x - entity.x
  const dy = partner.y - entity.y
  const dist = Math.hypot(dx, dy)
  if (dist <= 1) return
  entity.x += (dx / dist) * MATE_PURSUIT_SPEED * dt
  entity.y += (dy / dist) * MATE_PURSUIT_SPEED * dt
  clampAvatarEntityToWorld(entity, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(entity)
}

function releaseTransformForProduction(entity: CircleEntity): void {
  if (!entity.isFrozen) return
  entity.avatarRole = 'none'
  entity.isFrozen = false
  entity.name = entity.builderName || entity.name
  entity.pelletSpawnTimer = 0
  entity.structureProduceCount = 0
  entity.avatarTransformTimer = 0
}

/** 双向奔赴；moveSelf=false 时仅检测接触（用于玩家手动移动） */
export function updateMatePursuit(
  entity: CircleEntity,
  entities: CircleEntity[],
  dt: number,
  now = 0,
  moveSelf = true,
): boolean {
  if (!isPursuingMate(entity, now) || entity.productionStage !== 'none') {
    return false
  }

  const target = entities.find((e) => e.id === entity.aiMateTargetId && isActive(e) && isPursuingMate(e, now))
  if (!target) {
    entity.aiMateTargetId = 0
    return false
  }

  const male = entity.gender === 'male' ? entity : target
  const female = entity.gender === 'female' ? entity : target

  if (circlesTouch(entity, target) && canStartProduction(male, female, now)) {
    beginProductionPair(male, female)
    male.aiMateTargetId = 0
    female.aiMateTargetId = 0
    return true
  }

  if (moveSelf && !entity.isFrozen) moveTowardPartner(entity, target, dt)
  return true
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function canEngageProduction(entity: CircleEntity, gameTimeSec = 0): boolean {
  return isAdult(entity, gameTimeSec)
}

export function isSeekingMate(entity: CircleEntity, gameTimeSec = 0): boolean {
  if (!canEngageProduction(entity, gameTimeSec) || entity.productionStage !== 'none') return false
  if (entity.pendingAvatarKind !== 'none') return false
  if (entity.productionCooldown > 0) return false
  if (entity.mateIntentCooldownSec > 0) return false
  if (entity.mateIntentElapsedSec >= MATE_INTENT_WINDOW_SEC) return false
  return true
}

/** 求偶意愿：冷却结束也不必然立刻求偶，由个体意愿与随机波动决定 */
export function isActivelySeekingMate(entity: CircleEntity, now = 0): boolean {
  if (!isSeekingMate(entity, now)) return false
  const elder = elderMateFactor(entity, now)
  if (elder < 0.08) return false
  const roll = hash01(entity.id * 1.73 + Math.floor(now * 0.17) + entity.mateSeekUrge * 9.1)
  return roll < (0.28 + entity.mateSeekUrge * 0.62) * elder
}

export function tickMateIntent(entities: CircleEntity[], dt: number, gameTimeSec = 0): void {
  for (const entity of entities) {
    if (!isActive(entity) || !isAdult(entity, gameTimeSec)) continue
    if (entity.productionCooldown > 0) {
      entity.mateIntentElapsedSec = 0
      continue
    }
    if (entity.mateIntentCooldownSec > 0) {
      entity.mateIntentCooldownSec = Math.max(0, entity.mateIntentCooldownSec - dt)
      entity.mateIntentElapsedSec = 0
      continue
    }
    if (entity.productionStage !== 'none' || entity.pendingAvatarKind !== 'none') continue

    entity.mateIntentElapsedSec += dt
    if (entity.mateIntentElapsedSec < MATE_INTENT_WINDOW_SEC) continue

    entity.mateIntentElapsedSec = 0
    entity.mateIntentCycles++
    const exponent = Math.min(entity.mateIntentCycles - 1, 6)
    entity.mateIntentCooldownSec = MATE_INTENT_COOLDOWN_BASE_SEC * 2 ** exponent
    entity.aiMateTargetId = 0
  }
}

function circlesTouch(a: CircleEntity, b: CircleEntity): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  return dist < avatarEntityRadius(a) + avatarEntityRadius(b) - 2
}

export function canStartProduction(
  male: CircleEntity,
  female: CircleEntity,
  gameTimeSec = 0,
): boolean {
  if (!isAdult(male, gameTimeSec) || !isAdult(female, gameTimeSec)) return false
  if (male.gender !== 'male' || female.gender !== 'female') return false
  if (!isSeekingMate(male, gameTimeSec) || !isSeekingMate(female, gameTimeSec)) return false
  if (areKin(male, female)) return false
  return true
}

export function beginProductionPair(male: CircleEntity, female: CircleEntity): void {
  releaseTransformForProduction(male)
  releaseTransformForProduction(female)
  male.productionStage = 'active'
  female.productionStage = 'active'
  male.productionTimer = PRODUCTION_DURATION_SEC
  female.productionTimer = PRODUCTION_DURATION_SEC
  male.productionPartnerId = female.id
  female.productionPartnerId = male.id
  male.countProduceTransforms++
  female.countProduceTransforms++
  male.countProductionSessions++
  female.countProductionSessions++
  for (const e of [male, female]) {
    e.mateIntentElapsedSec = 0
    e.mateIntentCooldownSec = 0
    e.mateIntentCycles = 0
  }
}

function findPartner(entities: CircleEntity[], entity: CircleEntity): CircleEntity | null {
  const id = entity.productionPartnerId
  if (!id) return null
  return entities.find((e) => e.id === id && isActive(e)) ?? null
}

function spawnChild(
  entities: CircleEntity[],
  mother: CircleEntity,
  father: CircleEntity,
  birthGameTimeSec: number,
): CircleEntity[] {
  const gender: Gender = Math.random() < 0.5 ? 'male' : 'female'
  const childName = offspringName(father.name, mother.name, gender)
  const palette = inheritPalette(
    { colorLight: father.colorLight, colorDark: father.colorDark, strokeColor: father.strokeColor },
    { colorLight: mother.colorLight, colorDark: mother.colorDark, strokeColor: mother.strokeColor },
    mother.id * 1000 + father.id + Math.floor(birthGameTimeSec),
  )
  const angle = Math.random() * Math.PI * 2
  const dist = avatarEntityRadius(mother) + 40
  const child = createCircle(
    mother.x + Math.cos(angle) * dist,
    mother.y + Math.sin(angle) * dist,
    PLAYER_START_MASS,
    false,
    { name: childName, ...palette },
    {
      gender,
      generation: mother.generation + 1,
      motherId: mother.id,
      fatherId: father.id,
      familyId: mother.familyId || mother.id,
      birthGameTimeSec,
      paternalDna: father.dnaFingerprint,
      maternalDna: mother.dnaFingerprint,
    },
  )
  child.avatarRole = 'ally'
  child.motherBondTimer = OFFSPRING_MOTHER_BOND_SEC
  initAvatarVitality(child, birthGameTimeSec)
  clampAvatarEntityToWorld(child, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(child)
  mother.childrenCount++
  father.childrenCount++
  return [...entities, child]
}

function endProductionPair(male: CircleEntity, female: CircleEntity): void {
  for (const e of [male, female]) {
    e.productionStage = 'none'
    e.productionTimer = 0
    e.productionPartnerId = 0
    if (e.id !== female.id) e.pendingAvatarKind = 'none'
    e.mateIntentElapsedSec = 0
    e.mateIntentCooldownSec = 0
  }
  male.productionCooldown = PRODUCTION_COOLDOWN_SEC
  female.productionCooldown = PRODUCTION_COOLDOWN_SEC
  female.pendingAvatarKind = 'farm'
  female.aiAnchorX = female.x
  female.aiAnchorY = female.y
}

export function tickProductionCooldowns(entities: CircleEntity[], dt: number): void {
  for (const e of entities) {
    if (!isActive(e) || e.productionCooldown <= 0) continue
    e.productionCooldown = Math.max(0, e.productionCooldown - dt)
  }
}

export function updateProductionPairs(
  entities: CircleEntity[],
  dt: number,
  birthGameTimeSec: number,
): CircleEntity[] {
  let next = entities
  const processed = new Set<number>()

  for (const entity of entities) {
    if (!isActive(entity) || entity.productionStage !== 'active' || processed.has(entity.id)) continue
    const partner = findPartner(entities, entity)
    if (!partner) {
      entity.productionStage = 'none'
      entity.productionPartnerId = 0
      entity.productionTimer = 0
      continue
    }

    const male = entity.gender === 'male' ? entity : partner
    const female = entity.gender === 'female' ? entity : partner
    processed.add(male.id)
    processed.add(female.id)

    male.productionTimer -= dt
    female.productionTimer -= dt
    if (male.productionTimer <= 0) {
      next = spawnChild(next, female, male, birthGameTimeSec)
      endProductionPair(male, female)
    }
  }

  return next
}
