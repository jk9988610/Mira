import { PRODUCTION_COOLDOWN_SEC, PRODUCTION_DURATION_SEC } from './avatar-config'
import { avatarEntityRadius, clampAvatarEntityToWorld } from './avatar-radius'
import { initAvatarVitality } from './avatar-vitality'
import { inheritPalette } from './color-genetics'
import { areKin } from './kinship'
import { syncEntityGeo } from './geo'
import { offspringName } from './naming'
import type { CircleEntity, Gender } from './entity'
import { createCircle, isActive, isAdult } from './entity'
import { PLAYER_START_MASS } from './physics'
import { WORLD_HEIGHT, WORLD_WIDTH } from './world'

const SEEK_SCAN_RADIUS = 820

export function isSeekingMate(entity: CircleEntity): boolean {
  return (
    isAdult(entity) &&
    entity.productionStage === 'none' &&
    entity.productionCooldown <= 0 &&
    !entity.isFrozen
  )
}

function circlesTouch(a: CircleEntity, b: CircleEntity): boolean {
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  return dist < avatarEntityRadius(a) + avatarEntityRadius(b) - 2
}

export function canStartProduction(male: CircleEntity, female: CircleEntity): boolean {
  if (!isAdult(male) || !isAdult(female)) return false
  if (male.gender !== 'male' || female.gender !== 'female') return false
  if (!isSeekingMate(male) || !isSeekingMate(female)) return false
  if (male.isFrozen || female.isFrozen) return false
  if (areKin(male, female)) return false
  return true
}

export function beginProductionPair(male: CircleEntity, female: CircleEntity): void {
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
    },
  )
  child.avatarRole = 'ally'
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
    e.productionCooldown = PRODUCTION_COOLDOWN_SEC
  }
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

    const escortDist = avatarEntityRadius(male) + avatarEntityRadius(female) + 24
    const dx = female.x - male.x
    const dy = female.y - male.y
    const d = Math.hypot(dx, dy)
    if (d > escortDist && d > 1) {
      const speed = 100
      male.x += (dx / d) * speed * dt
      male.y += (dy / d) * speed * dt
      clampAvatarEntityToWorld(male, WORLD_WIDTH, WORLD_HEIGHT)
      syncEntityGeo(male)
    }

    male.productionTimer -= dt
    female.productionTimer -= dt
    if (male.productionTimer <= 0) {
      next = spawnChild(next, female, male, birthGameTimeSec)
      endProductionPair(male, female)
    }
  }

  return next
}

/** 雄性在求偶意图下扫描附近同等意图的异性（非近亲） */
export function findSeekingPartner(male: CircleEntity, entities: CircleEntity[]): CircleEntity | null {
  if (!isSeekingMate(male) || male.gender !== 'male') return null

  let best: CircleEntity | null = null
  let bestD = Infinity
  for (const other of entities) {
    if (other.id === male.id || !isActive(other) || other.isFrozen) continue
    if (!isSeekingMate(other) || other.gender !== 'female') continue
    if (areKin(male, other)) continue
    const d = Math.hypot(other.x - male.x, other.y - male.y)
    if (d < SEEK_SCAN_RADIUS && d < bestD) {
      bestD = d
      best = other
    }
  }
  return best
}

export function tryApproachForProduction(
  male: CircleEntity,
  entities: CircleEntity[],
  dt: number,
): boolean {
  if (!isSeekingMate(male) || male.gender !== 'male' || male.productionStage !== 'none') return false

  const target =
    (male.aiMateTargetId > 0
      ? entities.find((e) => e.id === male.aiMateTargetId && isSeekingMate(e))
      : null) ?? findSeekingPartner(male, entities)

  if (!target) {
    male.aiMateTargetId = 0
    return false
  }

  male.aiMateTargetId = target.id
  if (circlesTouch(male, target) && canStartProduction(male, target)) {
    beginProductionPair(male, target)
    male.aiMateTargetId = 0
    return true
  }

  const dx = target.x - male.x
  const dy = target.y - male.y
  const dist = Math.hypot(dx, dy)
  if (dist <= 1) return false
  const speed = 95
  male.x += (dx / dist) * speed * dt
  male.y += (dy / dist) * speed * dt
  clampAvatarEntityToWorld(male, WORLD_WIDTH, WORLD_HEIGHT)
  syncEntityGeo(male)
  return true
}

/** @deprecated 使用 findSeekingPartner */
export function tryPairProduction(seeker: CircleEntity, entities: CircleEntity[]): CircleEntity | null {
  if (seeker.gender === 'male') return findSeekingPartner(seeker, entities)
  return null
}
