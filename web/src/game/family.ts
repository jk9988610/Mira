import { needEat, needLearn, needPlay } from './avatar-needs'
import { isActivelySeekingMate } from './avatar-reproduction'
import type { CircleEntity, TransformKind } from './entity'
import { isActive, isJuvenile } from './entity'

const MOTHER_FOLLOW_RADIUS = 520
const MOTHER_COMFORT_RADIUS = 140
const OFFSPRING_CARE_RADIUS = 680
const MATE_WAIT_RADIUS = 520
const GROUP_SCAN_RADIUS = 920
const GROUP_STAY_RADIUS = 480
const GROUP_SEEK_RADIUS = 640

export function nearbyGroupCenter(
  entity: CircleEntity,
  entities: CircleEntity[],
  radius = GROUP_SCAN_RADIUS,
): { x: number; y: number } | null {
  let sumX = 0
  let sumY = 0
  let count = 0
  for (const other of entities) {
    if (other.id === entity.id || !isActive(other) || other.isFrozen) continue
    if (other.avatarRole !== 'none' && other.avatarRole !== 'ally') continue
    const d = distanceTo(entity, other)
    if (d > radius) continue
    sumX += other.x
    sumY += other.y
    count++
  }
  if (count === 0) return null
  return { x: sumX / count, y: sumY / count }
}

export function groupCohesionTarget(
  entity: CircleEntity,
  entities: CircleEntity[],
  seekingMate = false,
): { x: number; y: number } | null {
  const center = nearbyGroupCenter(entity, entities)
  if (!center) return null
  const maxDist = seekingMate ? GROUP_SEEK_RADIUS : GROUP_STAY_RADIUS
  const dist = Math.hypot(center.x - entity.x, center.y - entity.y)
  if (dist > maxDist) return center
  if (dist > maxDist * 0.55 && Math.random() < 0.18) return center
  return null
}

export function findMother(entity: CircleEntity, entities: CircleEntity[]): CircleEntity | null {
  if (entity.motherId <= 0) return null
  const mother = entities.find((e) => e.id === entity.motherId && isActive(e))
  return mother ?? null
}

export function distanceTo(entity: CircleEntity, other: CircleEntity): number {
  return Math.hypot(other.x - entity.x, other.y - entity.y)
}

/** 母亲身边的未成年后代 */
export function findNearbyJuvenileOffspring(
  mother: CircleEntity,
  entities: CircleEntity[],
  radius = OFFSPRING_CARE_RADIUS,
): CircleEntity[] {
  const out: CircleEntity[] = []
  for (const e of entities) {
    if (!isActive(e) || e.id === mother.id) continue
    if (!isJuvenile(e) || e.motherId !== mother.id) continue
    if (distanceTo(mother, e) <= radius) out.push(e)
  }
  return out
}

export function offspringCareTransformKind(offspring: CircleEntity[]): TransformKind {
  let eat = 0
  let learn = 0
  let play = 0
  for (const child of offspring) {
    eat += needEat(child)
    learn += needLearn(child)
    play += needPlay(child)
  }
  if (eat >= learn && eat >= play) return 'farm'
  if (learn >= play) return 'school'
  return 'park'
}

export function shouldMotherPrioritizeOffspring(
  mother: CircleEntity,
  entities: CircleEntity[],
  now = 0,
): boolean {
  if (mother.gender !== 'female' || !isActivelySeekingMate(mother, now)) return false
  return findNearbyJuvenileOffspring(mother, entities).length > 0
}

export function hasNearbySeekingMate(entity: CircleEntity, entities: CircleEntity[], now = 0): boolean {
  if (!isActivelySeekingMate(entity, now)) return false
  for (const other of entities) {
    if (other.id === entity.id || !isActive(other) || other.isFrozen) continue
    if (!isActivelySeekingMate(other, now)) continue
    if (distanceTo(entity, other) <= MATE_WAIT_RADIUS) return true
  }
  return false
}

export function juvenileMotherFollowTarget(
  juvenile: CircleEntity,
  mother: CircleEntity,
): { x: number; y: number } | null {
  const dist = distanceTo(juvenile, mother)
  if (dist > MOTHER_FOLLOW_RADIUS) return { x: mother.x, y: mother.y }
  if (dist > MOTHER_COMFORT_RADIUS && Math.random() < 0.22) return { x: mother.x, y: mother.y }
  return null
}
