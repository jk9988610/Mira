import { needEat, needLearn, needPlay } from './avatar-needs'
import { isSeekingMate } from './avatar-reproduction'
import type { CircleEntity, TransformKind } from './entity'
import { isActive, isJuvenile } from './entity'

const MOTHER_FOLLOW_RADIUS = 520
const MOTHER_COMFORT_RADIUS = 140
const OFFSPRING_CARE_RADIUS = 680
const MATE_WAIT_RADIUS = 520

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
): boolean {
  if (mother.gender !== 'female' || !isSeekingMate(mother)) return false
  return findNearbyJuvenileOffspring(mother, entities).length > 0
}

export function hasNearbySeekingMate(entity: CircleEntity, entities: CircleEntity[]): boolean {
  if (!isSeekingMate(entity)) return false
  for (const other of entities) {
    if (other.id === entity.id || !isActive(other) || other.isFrozen) continue
    if (!isSeekingMate(other)) continue
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
